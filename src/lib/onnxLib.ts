import * as ort from 'onnxruntime-web';

// Define the expected class names (You can modify this list based on your specific YOLO model's classes)
const YOLO_CLASSES = [
    "Deadstop", 
    "Running"
];

// Helper to load image and extract tensor
async function getImageTensorFromBase64(base64: string, dims: [number, number] = [640, 640]): Promise<ort.Tensor> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                return reject(new Error('Canvas not supported'));
            }
            canvas.width = dims[0];
            canvas.height = dims[1];
            
            // YOLO padding color
            ctx.fillStyle = 'rgb(114, 114, 114)';
            ctx.fillRect(0, 0, dims[0], dims[1]);

            // Calculate scale and padding for letterboxing
            const scale = Math.min(dims[0] / img.width, dims[1] / img.height);
            const new_w = img.width * scale;
            const new_h = img.height * scale;
            const pad_x = (dims[0] - new_w) / 2;
            const pad_y = (dims[1] - new_h) / 2;

            ctx.drawImage(img, pad_x, pad_y, new_w, new_h);
            
            const imageBufferData = ctx.getImageData(0, 0, dims[0], dims[1]).data;
            
            const [width, height] = dims;
            // Float32Array size is 1 * 3 * 640 * 640
            const float32Data = new Float32Array(3 * width * height);
            
            // Convert to NCHW
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const idx = (y * width + x) * 4;
                    // Normalize to 0.0 - 1.0
                    float32Data[y * width + x] = imageBufferData[idx] / 255.0; // R
                    float32Data[width * height + y * width + x] = imageBufferData[idx + 1] / 255.0; // G
                    float32Data[2 * width * height + y * width + x] = imageBufferData[idx + 2] / 255.0; // B
                }
            }
            const inputTensor = new ort.Tensor('float32', float32Data, [1, 3, height, width]);
            resolve(inputTensor);
        };
        img.onerror = reject;
        img.src = base64.startsWith('data:image') ? base64 : `data:image/jpeg;base64,${base64}`;
    });
}

function iou(box1: number[], box2: number[]) {
    const x1 = Math.max(box1[0], box2[0]);
    const y1 = Math.max(box1[1], box2[1]);
    const x2 = Math.min(box1[2], box2[2]);
    const y2 = Math.min(box1[3], box2[3]);
    
    const intersection = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
    const box1Area = (box1[2] - box1[0]) * (box1[3] - box1[1]);
    const box2Area = (box2[2] - box2[0]) * (box2[3] - box2[1]);
    
    return intersection / (box1Area + box2Area - intersection);
}

// Function to process ONNX detections (nms + conf threshold)
function processYoloOutput(tensor: ort.Tensor, threshold = 0.5, iouThreshold = 0.45) {
    // YOLO11 output shape is typically [1, num_classes + 4, 8400] OR [1, 8400, num_classes + 4]
    const data = tensor.data as Float32Array;
    let numRows = tensor.dims[1]; 
    let numCols = tensor.dims[2]; 

    // Handle transposition if exported differently
    const isTransposed = numRows > numCols;
    const numClasses = (isTransposed ? numCols : numRows) - 4;
    const numAnchors = isTransposed ? numRows : numCols;

    let boxes: {classId: number, conf: number, className: string, box: number[]}[] = [];

    // Loop through each anchor
    for (let anchorIdx = 0; anchorIdx < numAnchors; anchorIdx++) {
        let maxClassConf = 0;
        let classId = -1;

        // Find highest class confidence for this anchor
        for (let classIdx = 0; classIdx < numClasses; classIdx++) {
            const confIdx = isTransposed 
                ? (anchorIdx * numCols + 4 + classIdx) 
                : ((4 + classIdx) * numCols + anchorIdx);
            const conf = data[confIdx];
            if (conf > maxClassConf) {
                maxClassConf = conf;
                classId = classIdx;
            }
        }

        if (maxClassConf > threshold) {
            const cxIdx = isTransposed ? (anchorIdx * numCols + 0) : (0 * numCols + anchorIdx);
            const cyIdx = isTransposed ? (anchorIdx * numCols + 1) : (1 * numCols + anchorIdx);
            const wIdx = isTransposed ? (anchorIdx * numCols + 2) : (2 * numCols + anchorIdx);
            const hIdx = isTransposed ? (anchorIdx * numCols + 3) : (3 * numCols + anchorIdx);

            const cx = data[cxIdx];
            const cy = data[cyIdx];
            const w = data[wIdx];
            const h = data[hIdx];

            const x1 = cx - w / 2;
            const y1 = cy - h / 2;
            const x2 = cx + w / 2;
            const y2 = cy + h / 2;

            boxes.push({
                classId,
                className: YOLO_CLASSES[classId] || `Class ${classId}`,
                conf: maxClassConf,
                box: [x1, y1, x2, y2]
            });
        }
    }

    // Non-maximum Suppression (NMS)
    boxes.sort((a, b) => b.conf - a.conf);
    const finalBoxes = [];
    while (boxes.length > 0) {
        const bestBox = boxes[0];
        finalBoxes.push(bestBox);
        boxes = boxes.filter(b => b.classId !== bestBox.classId || iou(bestBox.box, b.box) < iouThreshold);
    }

    if (finalBoxes.length === 0) {
        let maxOverallConf = 0;
        let bestClass = -1;
        for (let anchorIdx = 0; anchorIdx < numAnchors; anchorIdx++) {
            for (let classIdx = 0; classIdx < numClasses; classIdx++) {
                const confIdx = isTransposed 
                    ? (anchorIdx * numCols + 4 + classIdx) 
                    : ((4 + classIdx) * numCols + anchorIdx);
                const conf = data[confIdx];
                if (conf > maxOverallConf) {
                    maxOverallConf = conf;
                    bestClass = classIdx;
                }
            }
        }
        console.log("No boxes passed threshold. Max confidence found:", maxOverallConf, "for class:", YOLO_CLASSES[bestClass] || bestClass);
    }

    return finalBoxes;
}

/**
 * Run ONNX inference locally on browser using onnxruntime-web
 */
export async function runLocalModel(onnxModelBuffer: ArrayBuffer, base64Images: {data: string}[]): Promise<string[]> {
    console.log("Loading ONNX Session...");
    // Configure WASM worker mapping
    ort.env.wasm.wasmPaths = 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.26.0/dist/';
    ort.env.wasm.numThreads = 1;
    ort.env.wasm.simd = false;
    
    // Create an InferenceSession from the ArrayBuffer
    const session = await ort.InferenceSession.create(onnxModelBuffer, { executionProviders: ['wasm'] });
    console.log("ONNX Session created successfully");

    const inputName = session.inputNames[0];
    const results = [];

    for (let i = 0; i < base64Images.length; i++) {
        try {
            console.log(`Running inference on frame ${i+1}...`);
            const tensor = await getImageTensorFromBase64(base64Images[i].data, [640, 640]);
            const feeds: Record<string, ort.Tensor> = {};
            feeds[inputName] = tensor;

            const output = await session.run(feeds);
            const outputTensor = output[session.outputNames[0]];
            console.log("Output tensor shape:", outputTensor.dims);

            const boxes = processYoloOutput(outputTensor, 0.1, 0.45);
            if (boxes.length > 0) {
                const labels = boxes.map(b => `${b.className} (${Math.round(b.conf * 100)}%)`);
                results.push(`Frame ${i + 1} Model Detects: ${labels.join(', ')}`);
            } else {
                results.push(`Frame ${i + 1} Model Detects: None`);
            }
        } catch (e) {
            console.error(`Failed inference on frame ${i}`, e);
            results.push(`Frame ${i + 1} Error`);
        }
    }

    return results;
}
