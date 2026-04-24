import React, { useState, useRef, useEffect, useCallback } from "react";
import { 
  Train, 
  Upload, 
  FileText, 
  AlertCircle, 
  CheckCircle2, 
  Loader2, 
  History, 
  MessageSquare,
  ChevronRight,
  ShieldAlert,
  Cpu,
  Zap,
  Eye,
  Activity,
  Printer,
  X,
  Sparkles,
  Video,
  Clock,
  Settings,
  Database,
  Lock,
  Trash2,
  Download
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { GoogleGenAI } from "@google/genai";
import { auth, db, signInWithGoogle } from "./firebase";
import { collection, addDoc, query, orderBy, limit, onSnapshot } from "firebase/firestore";
import { onAuthStateChanged, User } from "firebase/auth";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { handleFirestoreError, OperationType } from "./lib/firestoreUtils";
import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile } from "@ffmpeg/util";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const MASTER_PROMPT = `
Master Prompt: Indian Railway CVVRS (Crew Video & Voice Recording System) Analysis
Role & Context:
Act as an expert Video Analyst for Indian Railways, specializing in the monitoring of Locomotive Pilots (LP) and Assistant Locomotive Pilots (ALP) in conventional and three-phase locomotives. Your analysis must strictly adhere to Indian Railway codes, manuals, rule books, and circulars issued by the Railway Board and Western Railways (e.g., G&SR, Accident Manuals).

Task:
Analyze the provided frames from the CVVRS system to detect the equipment in the locomotive cab and the activities of the crew. Generate a detailed "Compliance Summary & Deviation Table" and a summary of corrective measures.

A. Activity Analysis - Running Condition
Detect "Running Condition" with EXTREME precision. You MUST use intense OPTICAL CHARACTER RECOGNITION (OCR) on the loco desk. If ANY of these five indicators show motion, treat the train as RUNNING:
1. DDS Speedometer (Digital): Zoom in heavily on the Diagnostic Display System (DDS) monitor. Look for the EXACT numerical digits (km/h) shown on the screen. If the number is > 0, IT IS RUNNING.
2. ESMON Speedometer (Analog/Digital): Look at the separate ESMON gauge. Read the red LED digit readout inside it. Also verify if the physical needle is lifted above the '0' mark. If the number or needle is above zero, IT IS RUNNING.
3. Motion Blur outside Lookout Glass: Analyze the tracks, overhead equipment (OHE) masts, or scenery outside the windshield. If there is noticeable motion blur or structural displacement between consecutive frames, IT IS RUNNING.
4. Throttle (Master Controller) Position: Look at the vertical handle. If pushed forward into the traction zone, IT IS RUNNING.
5. Reverser Position: If the small horizontal handle below the DDS is pointing forward (not in neutral), IT IS READY/RUNNING.
CRITICAL OCR COMMAND: DO NOT merely glance at the screens. You MUST actively read the raw digits on the DDS and ESMON. If a number like '45' or '10' is visible, the train is moving.

If these indicators are active, or if you observe relative motion between the loco window and the outside environment, the train is in running condition.
When the train is in motion, check the following: LP AND APL WEAR SKY BLUE SHIRT AND NAVY BLUE TROUSER SO MAKE REPORT ONLY OF THAT DRESS CODE STAFF. BUT IN WINTER HE MAY WEAR JACKET.
1. Signal Calling (CRITICAL EVENT LOGGING): Is the crew calling out signal aspects with the proper confirmed hand gesture (e.g., raising the left or right hand)? You MUST LOG the exact visible on-screen timestamp (e.g., [09:07:44]) from the CVVRS footage for EVERY single instance where a hand is raised for signal calling.
2. Alertness: Is the crew visibly alert?
3. Nap/Micro-Sleep: Is the crew taking a nap or showing signs of micro-sleep?
4. Distraction: Is the crew distracted from looking ahead through the lookout glass? (Neglect distractions lasting < 07 seconds).
5. Mobile Usage: Is the crew using a mobile phone?
6. Writing Work: Is the crew performing writing work while the train is in motion?
7. RS Valve (ALP): Does the ALP place their hand on the RS (Emergency Brake) valve upon approaching a danger signal?
8. Exchange Signals: Is the crew exchanging "ALL RIGHT" signals with station staff and trains in the opposite direction?
9. Horn Operation: Is the crew operating the horn lever/switch as per requirement (e.g., Whistle Boards)?
10. Packing: Is the crew involved in packing their belongings?
11. Leaving Seat: Is the crew leaving their designated place for other activities?

B. Activity Analysis - Stationary Condition
Detect "Stationary Condition" by checking that the white digital needle on the DDS speedometer and the ESMON speedometer needle are both at zero, the Throttle (Master Controller) is in the Neutral position, and the Reverser handle is in Neutral. You should also verify this with the lack of relative motion between the locomotive and the outside environment.
When the train is stopped, check the following:
1. Loco Check (ALP): Is the ALP getting down from the cab to check the locomotive (under-gear/equipment)?
2. SA-9 Application: Is the Loco Pilot applying the SA-9 (Independent Brake) when the train comes to a halt?
3. Reverser Neutral: Is the Loco Pilot keeping the reverser switch in the Neutral position?
4. Nap/Micro-Sleep: Is the crew taking a nap or showing signs of micro-sleep?

C. Report Structure & Formatting
The final output must be a structured report with the following elements in this EXACT sequence:

1. Heading: CVVRS Intelligence Analysis Report

2. Subheadings:
   - Locomotive ID: [Detected ID or from context]
   - Date of Recording: [Detected Date or from context]
   - Train No: [From context if provided]
   - LP Name & HQ: [From context if provided]
   - ALP Name & HQ: [From context if provided]
   - Analyzer CLI Name: [From context if provided]
   - Observation Period: [Start Time] to [End Time]

3. Chronological Event Log (CRITICAL):
   Provide a detailed timeline log of all notable interactions observed in the footage. Always extract the real "on-screen" burned-in timestamp for each log.
   *Example:*
   - [09:07:44]: ALP raised left hand to call out signal.
   - [09:12:15]: Loco Pilot seen using control panel.
   *(List all detected events in strict chronological order)*

4. Detailed Analysis:
   - Mandatory Checkpoints: You MUST explicitly state the following points in this section, regardless of whether it's compliant or not:
     1. Mobile Phone Usage: If they are not talking on a mobile phone, explicitly state "LP & ALP did not use mobile phone". If they did, document the usage.
     2. Signal Calling: Explicitly state the use of calling out signals with hand gestures or not.
     3. Standstill Condition: Explicitly state whether the reverser and throttle are in neutral condition or not while the loco is in stand still condition.
     4. Crew Communication: Explicitly state whether they are talking with each other during the whole journey or not.
   - Non-Compliance Observations: List all violations, deviations, or non-compliant activities here AFTER the mandatory checkpoints. This is the most important section. If no violations are found, state "No non-compliance detected."
     CRITICAL: For each individual Non-Compliance Observation, you MUST identify exactly ONE specific frame that best illustrates the violation. At the very end of the description for that specific observation (on a new line), insert the tag [[FRAME_IMAGE:n]] where n is the frame number. Do NOT include more than one photo per observation.
   - Compliance Observations: List all compliant activities and routine checks here. Do NOT include frame tags in this section unless explicitly necessary for safety verification.

5. Compliance Summary & Deviation Table:
   Provide a markdown table with horizontal and vertical lines (using markdown table syntax). You MUST include pipes (|) at the beginning and end of every row to ensure a proper grid structure. IMPORTANT: Each row MUST be on a new line. Do NOT combine multiple rows into a single line.
   Format:
   | Timestamp (Video Clock) | Timestamp (Video Streaming) | Activity Category | Compliance Status | Deviation Description |
   |:---|:---|:---|:---|:---|
   | [Time] | [Time] | [Category] | [Compliance / Non-Compliance] | [Details] |

6. Disciplinary Summary:
   - Corrective Measures: (e.g., Counseling, Refresher Training).
   IMPORTANT: The "Charge Sheet & Punishment" section must be completely removed from the analysis output.

Constraints:
- Prioritize accuracy over speed.
- Utilize previous user corrections regarding terminology (e.g., use "Driving Desk" instead of "Control Stand").
- Ensure the table has horizontal and vertical lines as per markdown standards.
- CRITICAL: Do NOT include "Author: CELE SIR" or "Visionary Leadership" anywhere in the generated report.
`;

const NeuralFlow = () => {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-40">
      <svg className="w-full h-full" viewBox="0 0 800 600">
        <defs>
          <linearGradient id="flowGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="transparent" />
            <stop offset="50%" stopColor="#00f2ff" />
            <stop offset="100%" stopColor="transparent" />
          </linearGradient>
          <linearGradient id="magentaGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="transparent" />
            <stop offset="50%" stopColor="#ff007f" />
            <stop offset="100%" stopColor="transparent" />
          </linearGradient>
        </defs>
        {[...Array(12)].map((_, i) => (
          <motion.path
            key={i}
            d={`M ${-100 + i * 80} ${600} Q ${100 + i * 80} ${300} ${400} ${0}`}
            stroke={i % 2 === 0 ? "url(#flowGradient)" : "url(#magentaGradient)"}
            strokeWidth="2"
            fill="transparent"
            initial={{ pathLength: 0, pathOffset: 0, opacity: 0 }}
            animate={{ 
              pathLength: [0, 0.5, 0],
              pathOffset: [0, 1],
              opacity: [0, 1, 0]
            }}
            transition={{
              duration: 3 + Math.random() * 2,
              repeat: Infinity,
              ease: "linear",
              delay: i * 0.4
            }}
          />
        ))}
        {[...Array(20)].map((_, i) => (
          <motion.circle
            key={`node-${i}`}
            r="2"
            fill={i % 2 === 0 ? "#00f2ff" : "#ff007f"}
            initial={{ opacity: 0 }}
            animate={{ 
              opacity: [0, 0.8, 0],
              scale: [0.5, 1.5, 0.5],
              x: Math.random() * 800,
              y: Math.random() * 600
            }}
            transition={{
              duration: 2 + Math.random() * 3,
              repeat: Infinity,
              delay: Math.random() * 5
            }}
          />
        ))}
      </svg>
    </div>
  );
};

export default function App() {
  const [file, setFile] = useState<File | null>(null);
  const [feedback, setFeedback] = useState("");
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<string | null>(null);
  const [extractedFrames, setExtractedFrames] = useState<{ data: string, mimeType: string }[]>([]);
  const [userDeviationReport, setUserDeviationReport] = useState("");
  const [manualLocoNo, setManualLocoNo] = useState("");
  const [manualDateTime, setManualDateTime] = useState("");
  const [trainNo, setTrainNo] = useState("");
  const [lpNameHQ, setLpNameHQ] = useState("");
  const [alpNameHQ, setAlpNameHQ] = useState("");
  const [analyzerCliName, setAnalyzerCliName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loadingStep, setLoadingStep] = useState(0);
  const [retryStatus, setRetryStatus] = useState<string | null>(null);
  const [loadingMode, setLoadingMode] = useState<'extracting' | 'analyzing'>('extracting');
  const [progress, setProgress] = useState(0);
  const [pastCorrections, setPastCorrections] = useState<any[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [firebaseError, setFirebaseError] = useState<string | null>(null);
  const [userApiKey, setUserApiKey] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem("CVVRS_USER_API_KEY") || "";
    }
    return "";
  });
  const [showSettings, setShowSettings] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Auth Listener
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsAuthReady(true);
    });

    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (!user) {
      setPastCorrections([]);
      return;
    }

    // Fetch global corrections from Firestore when authenticated
    const q = query(collection(db, "corrections"), orderBy("timestamp", "desc"), limit(50));
    const unsubscribeFirestore = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => doc.data());
      console.log("Fetched corrections:", data.length);
      setPastCorrections(data);
      setFirebaseError(null);
    }, (error) => {
      console.error("Firestore Error:", error);
      setFirebaseError("Database connection issue. Please check your permissions or network.");
      // We don't throw here to prevent crashing the whole app, just show in UI
    });

    return () => unsubscribeFirestore();
  }, [user]);

  const handleSignIn = async () => {
    try {
      await signInWithGoogle();
    } catch (err: any) {
      console.error("Sign-In Error:", err);
      if (err.code === 'auth/unauthorized-domain') {
        setError(`Sign-In Failed: This domain (${window.location.hostname}) is not authorized in the Firebase Console. Please double-check that this exact domain is added to the 'Authorized Domains' list in Firebase Authentication settings.`);
      } else if (err.code === 'auth/popup-blocked') {
        setError("Sign-In Failed: The login popup was blocked by your browser. Please allow popups for this site.");
      } else {
        setError(`Sign-In Failed: ${err.message}`);
      }
    }
  };

  const saveApiKey = (key: string) => {
    setUserApiKey(key);
    localStorage.setItem("CVVRS_USER_API_KEY", key);
    setShowSettings(false);
  };

  const extractionSteps = [
    "Initializing Neural Engine...",
    "Accessing Video Stream...",
    "Extracting High-Resolution Frames...",
    "Buffering Neural Data...",
    "Finalizing Frame Buffer..."
  ];

  const analysisSteps = [
    "Detecting Crew Activities...",
    "Analyzing Compliance Standards...",
    "Comparing with G&SR Rulebook...",
    "Generating CVVRS Intelligence Report...",
    "Deep OCR Scanning (Pro Model) - This may take 30-60s...",
    "Neural Engine Overloaded - Retrying..."
  ];

  const loadingSteps = loadingMode === 'extracting' ? extractionSteps : analysisSteps;

  const removeFrameFromReport = (tag: string) => {
    if (!report) return;
    // Use a regex that matches the exact tag case-insensitively with flexible spacing
    const escapedTag = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escapedTag, 'gi');
    setReport(report.replace(regex, ''));
  };

  const renderContentWithFrames = useCallback((content: any): any => {
    if (typeof content === 'string') {
      // Extremely permissive regex to catch variations in AI output
      const tagRegex = /\[{1,2}\s*FRAME_IMAGE\s*[:\-]?\s*(\d+)\s*\]{1,2}/gi;
      const parts = content.split(/(\[{1,2}\s*FRAME_IMAGE\s*[:\-]?\s*\d+\s*\]{1,2})/i);
      
      if (parts.length === 1) return content;

      return parts.map((part, i) => {
        const match = part.match(/\[{1,2}\s*FRAME_IMAGE\s*[:\-]?\s*(\d+)\s*\]{1,2}/i);
        if (match) {
          const frameIndex = parseInt(match[1]) - 1;
          const frame = extractedFrames[frameIndex];
          if (frame) {
            return (
              <div key={i} className="my-4 relative group print:my-2 print:inline-block print:mr-4">
                <div className="relative overflow-hidden rounded-xl border border-brand-cyan/30 shadow-[0_0_20px_rgba(0,242,255,0.1)] w-full max-w-[400px] print:w-[74mm] print:h-auto print:border-black/20 print:shadow-none">
                  <img 
                    src={`data:${frame.mimeType};base64,${frame.data}`} 
                    alt={`Evidence Frame ${match[1]}`}
                    className="w-full h-auto object-cover transition-transform duration-500 group-hover:scale-105"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute top-1 left-1 px-1.5 py-0.5 rounded-full bg-brand-cyan/20 border border-brand-cyan/30 backdrop-blur-md text-[7px] font-black text-brand-cyan uppercase tracking-widest print:bg-white/80 print:text-black print:border-black/10">
                    Frame {match[1]}
                  </div>
                  
                  {/* Delete Button - Hidden on Print */}
                  <button 
                    onClick={() => removeFrameFromReport(part)}
                    className="absolute top-1 right-1 p-1 rounded-lg bg-red-500/20 border border-red-500/30 backdrop-blur-md text-red-500 hover:bg-red-500 hover:text-white transition-all opacity-0 group-hover:opacity-100 no-print"
                    title="Remove from Report"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          } else {
            return (
              <span key={i} className="text-brand-magenta text-[10px] font-mono italic">
                [Frame {match[1]} Missing in Buffer]
              </span>
            );
          }
        }
        return part;
      });
    }

    if (Array.isArray(content)) {
      return content.map((child, i) => (
        <React.Fragment key={i}>
          {renderContentWithFrames(child)}
        </React.Fragment>
      ));
    }

    if (React.isValidElement(content)) {
      const children = (content.props as any).children;
      if (children) {
        return React.cloneElement(content as React.ReactElement, {
          children: renderContentWithFrames(children)
        } as any);
      }
    }

    return content;
  }, [extractedFrames]);

  useEffect(() => {
    let interval: any;
    if (loading) {
      interval = setInterval(() => {
        setLoadingStep((prev) => (prev + 1) % loadingSteps.length);
      }, 3000);
    } else {
      setLoadingStep(0);
    }
    return () => clearInterval(interval);
  }, [loading]);

  const removeFrameFromBuffer = (index: number) => {
    setExtractedFrames(prev => prev.filter((_, i) => i !== index));
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setError(null);
      setReport(null);
      setProgress(0);
      setExtractedFrames([]);
      
      // Auto-extract frames for preview
      setLoadingMode('extracting');
      setLoading(true);
      try {
        const frames = await extractFrames(selectedFile);
        setExtractedFrames(frames);
      } catch (err: any) {
        setError("Frame Extraction Failed: " + err.message);
      } finally {
        setLoading(false);
      }
    }
  };

  const extractFramesWithFFmpeg = async (file: File, intervalSeconds: number = 5): Promise<{ data: string, mimeType: string }[]> => {
    const ffmpeg = new FFmpeg();
    
    ffmpeg.on('log', ({ message }) => {
      console.log('FFmpeg:', message);
    });

    ffmpeg.on('progress', ({ progress: prog }) => {
      setProgress(Math.min(99, Math.round(prog * 100)));
    });

    try {
      await ffmpeg.load({
        coreURL: 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.js',
        wasmURL: 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.wasm',
      });

      const name = file.name;
      await ffmpeg.writeFile(name, await fetchFile(file));

      // Extract 1 frame every intervalSeconds, scale down to max 640x480
      const fps = (1 / intervalSeconds).toFixed(4);
      await ffmpeg.exec(['-i', name, '-vf', `fps=${fps},scale=640:-1`, '-q:v', '5', 'frame_%03d.jpg']);

      const frames: { data: string, mimeType: string }[] = [];
      const files = await ffmpeg.listDir('/');
      
      const frameFiles = files.filter(f => f.name.startsWith('frame_') && f.name.endsWith('.jpg')).sort((a, b) => a.name.localeCompare(b.name));
      
      for (const f of frameFiles) {
        const fileData = await ffmpeg.readFile(f.name);
        
        if (fileData instanceof Uint8Array) {
           let base64 = "";
           const chunk = 32768; // Chunk to prevent Maximum call stack size exceeded
           for (let i = 0; i < fileData.length; i += chunk) {
              base64 += String.fromCharCode.apply(null, Array.from(fileData.subarray(i, i + chunk)));
           }
           frames.push({
              data: btoa(base64),
              mimeType: 'image/jpeg',
           });
           if (frames.length >= 11) break;
        }
      }

      setProgress(100);
      return frames;
    } catch (err) {
      console.error("FFmpeg error:", err);
      throw err;
    }
  };

  const extractFrames = async (file: File, intervalSeconds: number = 5): Promise<{ data: string, mimeType: string }[]> => {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      // Use 'auto' instead of 'metadata' for better compatibility with some large files
      video.preload = 'auto';
      const videoUrl = URL.createObjectURL(file);
      video.src = videoUrl;
      video.muted = true;
      video.playsInline = true;

      // Add to DOM hidden to ensure some browsers process it correctly
      video.style.display = 'none';
      document.body.appendChild(video);

      const cleanup = () => {
        URL.revokeObjectURL(videoUrl);
        if (video.parentNode) {
          document.body.removeChild(video);
        }
      };

      video.onloadedmetadata = async () => {
        try {
          const duration = video.duration;
          const frames: { data: string, mimeType: string }[] = [];
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          
          // Scale down for faster processing while maintaining clarity
          const scale = 0.5;
          canvas.width = video.videoWidth * scale;
          canvas.height = video.videoHeight * scale;

          // Extract frames at intervals
          // For very long videos, we cap the number of frames to 11 for speed and token safety
          const step = Math.max(intervalSeconds, duration / 11); 

          for (let time = 0; time < duration; time += step) {
            setProgress(Math.min(99, Math.round((time / duration) * 100)));
            
            // Seek and wait for the frame to be ready
            await new Promise((resolveSeek, rejectSeek) => {
              const onSeeked = () => {
                video.removeEventListener('seeked', onSeeked);
                video.removeEventListener('error', onSeekError);
                resolveSeek(true);
              };
              const onSeekError = () => {
                video.removeEventListener('seeked', onSeeked);
                video.removeEventListener('error', onSeekError);
                rejectSeek(new Error("Seek failed"));
              };
              video.addEventListener('seeked', onSeeked);
              video.addEventListener('error', onSeekError);
              video.currentTime = time;
            });
            
            if (ctx) {
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
              const base64 = canvas.toDataURL('image/jpeg', 0.7).split(',')[1];
              frames.push({ data: base64, mimeType: 'image/jpeg' });
            }
            
            if (frames.length >= 11) break;
          }

          setProgress(100);
          cleanup();
          resolve(frames);
        } catch (err) {
          cleanup();
          reject(err);
        }
      };

      video.onerror = async () => {
        let errorMsg = video.error ? `${video.error.message} (Code: ${video.error.code})` : "Unknown video error";
        
        // Specific advice for Code 4 (Demuxer error / Unsupported format)
        if (video.error?.code === 4 || errorMsg.includes("DEMUXER_ERROR")) {
          console.log("Native video extraction failed. Attempting FFmpeg fallback...");
          try {
             const frames = await extractFramesWithFFmpeg(file, intervalSeconds);
             cleanup();
             resolve(frames);
             return;
          } catch(ffmpegErr) {
             console.error("FFmpeg fallback failed:", ffmpegErr);
             errorMsg = "The video format is not natively supported by your browser's engine, and the alternative FFmpeg extraction also failed. Please convert the video to a standard MP4 (H.264) format using a tool like Handbrake or VLC before uploading.";
          }
        }
        
        cleanup();
        reject(new Error(`Failed to load video for frame extraction: ${errorMsg}`));
      };
    });
  };

  const generateContentWithRetry = async (ai: GoogleGenAI, params: any, maxRetries = 7) => {
    let lastError: any;
    for (let i = 0; i < maxRetries; i++) {
      try {
        if (i > 0) {
          setRetryStatus(`Retry ${i}/${maxRetries}: Optimizing Neural Path...`);
        }
        const response = await ai.models.generateContent(params);
        setRetryStatus(null);
        return response;
      } catch (err: any) {
        lastError = err;
        const errorMessage = (err.message || "").toLowerCase();
        
        const isQuota = errorMessage.includes("429") || errorMessage.includes("quota") || errorMessage.includes("rate limit");
        const isOverloaded = errorMessage.includes("503") || errorMessage.includes("overloaded") || errorMessage.includes("high demand") || errorMessage.includes("unavailable");
        const isTimeout = errorMessage.includes("deadline exceeded");

        if ((isQuota || isOverloaded || isTimeout) && i < maxRetries - 1) {
          // Exponential backoff with jitter
          const baseDelay = isQuota ? 15000 : 5000;
          const delay = Math.pow(1.3, i) * baseDelay + Math.random() * 3000;
          
          const waitSecs = Math.round(delay / 1000);
          setRetryStatus(`Neural Engine ${isQuota ? 'Busy' : 'Overloaded'}. Re-aligning in ${waitSecs}s...`);
          
          console.warn(`Neural Engine issue (${isQuota ? 'Quota' : 'Load'}), retrying in ${Math.round(delay)}ms... (Attempt ${i + 1}/${maxRetries})`);
          
          setLoadingStep(loadingSteps.length - 1); 
          
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        setRetryStatus(null);
        throw err;
      }
    }
    setRetryStatus(null);
    throw lastError;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      setError("Login Required: Please sign in with Google to perform analysis and contribute to the Neural Learning History.");
      return;
    }
    if (!file) {
      setError("Please select a CVVRS video file first.");
      return;
    }

    setLoadingMode('analyzing');
    setLoading(true);
    setReport(null);
    setError(null);
    setProgress(0);
    setUserDeviationReport("");

    let progressInterval: any;
    try {
      // Check if the entered key is actually the admin password
      // Use process.env directly (defined by Vite build tool)
      const adminPassword = process.env.ADMIN_PASSWORD || "";
      let apiKey = userApiKey.trim();

      if (adminPassword && apiKey === adminPassword.trim()) {
        apiKey = (process.env.GEMINI_API_KEY || "").trim();
      }

      if (!apiKey || apiKey === "undefined" || apiKey === "null") {
        setShowSettings(true);
        throw new Error("Personal API Key Required: To protect system quota, every user must provide their own Gemini API key. If you are the owner, please enter your Admin Password in the Personal Key field.");
      }

      const ai = new GoogleGenAI({ apiKey });
      
      // Use existing frames if available, otherwise extract
      let frames = extractedFrames;
      if (frames.length === 0) {
        setLoadingMode('extracting');
        frames = await extractFrames(file);
        setExtractedFrames(frames);
        setLoadingMode('analyzing');
      }
      
      // 3. Prepare Neural Prompt with Global Learning
      // Simulate analysis progress while AI is thinking
      let currentProgress = 0;
      progressInterval = setInterval(() => {
        setProgress(prev => {
          const next = prev >= 95 ? prev : prev + Math.floor(Math.random() * 4) + 1;
          
          // Step logic mapping
          if (next > 90) {
            setLoadingStep(4); // Intense OCR Scanning
          } else if (next > 75) {
            setLoadingStep(3); // Generating Report
          } else if (next > 50) {
            setLoadingStep(2); // Comparing Rules
          } else if (next > 25) {
            setLoadingStep(1); // Analyzing Compliance
          } else {
            setLoadingStep(0); // Detecting Activities
          }
          
          return next;
        });
      }, 1500);
      const locoContext = manualLocoNo ? `\nIMPORTANT: The Locomotive ID for this analysis is: ${manualLocoNo}. Please use this ID in the report header.` : "";
      const dateContext = manualDateTime ? `\nIMPORTANT: The Date/Time of Recording for this analysis is: ${manualDateTime}. Please use this in the report header.` : "";
      const trainContext = trainNo ? `\nIMPORTANT: The Train No. is: ${trainNo}. Include this in the subheadings.` : "";
      const lpContext = lpNameHQ ? `\nIMPORTANT: LP Name & HQ is: ${lpNameHQ}. Include this in the subheadings.` : "";
      const alpContext = alpNameHQ ? `\nIMPORTANT: ALP Name & HQ is: ${alpNameHQ}. Include this in the subheadings.` : "";
      const analyzerContext = analyzerCliName ? `\nIMPORTANT: Analyzer CLI Name is: ${analyzerCliName}. Include this in the subheadings.` : "";
      
      const learningContext = pastCorrections.length > 0 
        ? `\nPAST GLOBAL CORRECTIONS (Learn from these mistakes across all users): ${pastCorrections.map(c => `[Context: ${c.context}] -> Correction: ${c.correction}`).join('; ')}`
        : "";

      const promptWithFeedback = `${MASTER_PROMPT}${locoContext}${dateContext}${trainContext}${lpContext}${alpContext}${analyzerContext}${feedback ? `\n\nAdditional User Feedback to consider: ${feedback}` : ""}${learningContext}`;

      let response;
      try {
        // Primary Attempt: High-Reasoning Pro Model
        response = await generateContentWithRetry(ai, {
          model: "gemini-3.1-pro-preview",
          contents: [
            {
              parts: [
                ...frames.flatMap((frame, index) => [
                  { text: `Frame ${index + 1}:` },
                  { inlineData: frame }
                ]),
                { text: promptWithFeedback }
              ]
            }
          ]
        });
      } catch (proErr: any) {
        const errMsg = proErr.message || "";
        const isQuotaError = errMsg.includes("429") || errMsg.toLowerCase().includes("quota") || errMsg.toLowerCase().includes("rate limit");
        
        if (isQuotaError) {
          console.warn("Pro model quota exceeded. Falling back to Flash model for continuity...");
          setLoadingStep(loadingSteps.length - 1); // "Retrying..."
          
          // Secondary Attempt: High-Quota Flash Model
          response = await generateContentWithRetry(ai, {
            model: "gemini-3-flash-preview",
            contents: [
              {
                parts: [
                  ...frames.flatMap((frame, index) => [
                    { text: `Frame ${index + 1}:` },
                    { inlineData: frame }
                  ]),
                  { text: promptWithFeedback }
                ]
              }
            ]
          });
        } else {
          throw proErr;
        }
      }

      if (!response || !response.text) {
        throw new Error("AI failed to generate a report. Please try again with a different video.");
      }

      // Clear the progress interval if we added one
      // (We'll handle this in the finally block by clearing the interval)
      
      setReport(response.text);
      
      // 5. Save this run to Firebase if context was provided (Learning)
      if (user) {
        try {
          await addDoc(collection(db, "corrections"), {
            context: feedback.trim() || "Automated Analysis Run",
            correction: response.text?.substring(0, 1000), // Save summary for learning
            userEmail: user.email || "anonymous",
            authorUid: user.uid,
            timestamp: new Date().toISOString()
          });
          console.log("Data stored in Firebase successfully");
        } catch (e) {
          console.error("Failed to save to Firebase:", e);
        }
      }
    } catch (err: any) {
      console.error("Analysis Error:", err);
      let errorMessage = err.message || "An unexpected error occurred during analysis.";
      
      if (errorMessage.includes("429") || errorMessage.toLowerCase().includes("quota") || errorMessage.toLowerCase().includes("rate limit")) {
        errorMessage = "AI Quota Exceeded: Both the Pro and Flash models have reached their temporary limit for your API key. Please wait about 60 seconds and try again. TIP: Using your own Gemini API Key from Google AI Studio will provide you with a much higher personal quota.";
      } else if (errorMessage.includes("503") || errorMessage.toLowerCase().includes("high demand") || errorMessage.toLowerCase().includes("unavailable")) {
        errorMessage = "Neural Engine Overloaded: Google's AI models are currently experiencing extremely high demand globally. We attempted several retries, but the service is still unavailable. Please wait a minute and try again.";
      }
      
      setError(errorMessage);
    } finally {
      if (progressInterval) clearInterval(progressInterval);
      setLoading(false);
      setProgress(100);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-cyan-500/30 overflow-x-hidden print:overflow-visible print:bg-white print:text-black print:min-h-0 print:h-auto">
      <div className="ai-aura-bg" />
      <div className="fixed inset-0 digital-grid pointer-events-none" />
      
      {/* Floating Particles */}
      <div className="fixed inset-0 pointer-events-none z-0">
        {[...Array(20)].map((_, i) => (
          <motion.div
            key={i}
            initial={{ 
              x: Math.random() * window.innerWidth, 
              y: Math.random() * window.innerHeight,
              opacity: Math.random() * 0.5
            }}
            animate={{ 
              x: Math.random() * window.innerWidth, 
              y: Math.random() * window.innerHeight,
              opacity: [0.2, 0.5, 0.2]
            }}
            transition={{ 
              duration: 10 + Math.random() * 20, 
              repeat: Infinity, 
              ease: "linear" 
            }}
            className="absolute w-1 h-1 bg-brand-cyan rounded-full blur-[1px]"
          />
        ))}
      </div>
      
      {/* Decorative Background Blobs */}
      <div className="fixed top-[-10%] left-[-10%] w-[50%] h-[50%] bg-brand-blue/20 blur-[150px] rounded-full animate-pulse-slow pointer-events-none no-print" />
      <div className="fixed bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-brand-magenta/15 blur-[150px] rounded-full animate-pulse-slow pointer-events-none no-print" style={{ animationDelay: '2s' }} />
      <div className="fixed top-[20%] right-[10%] w-[30%] h-[30%] bg-brand-cyan/10 blur-[120px] rounded-full animate-float pointer-events-none no-print" />

      {/* Navigation */}
      <nav className="sticky top-0 z-50 glass-card border-x-0 border-t-0">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4 group cursor-pointer">
            <div className="relative">
              <div className="absolute inset-0 bg-brand-cyan/20 blur-lg rounded-full group-hover:bg-brand-cyan/40 transition-all" />
              <div className="relative w-12 h-12 bg-black rounded-xl border border-brand-cyan/30 flex items-center justify-center overflow-hidden">
                <Cpu className="w-7 h-7 text-brand-cyan animate-float" />
                <div className="absolute inset-0 bg-gradient-to-tr from-brand-cyan/10 to-transparent" />
              </div>
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tighter italic glow-text flex items-center gap-3">
                CVVRS <span className="text-brand-cyan">AI</span>
                <span className="text-[8px] font-black text-brand-cyan/40 uppercase tracking-[0.2em] border border-brand-cyan/20 px-2 py-0.5 rounded-full bg-brand-cyan/5 italic">Visionary: CELE SIR</span>
              </h1>
              <p className="text-[10px] font-bold text-white/60 uppercase tracking-[0.3em]">Neural Analysis Engine</p>
            </div>
          </div>
            <div className="hidden md:flex items-center gap-8">
            
            {user ? (
              <div className="flex items-center gap-4 pl-2">
                <div className="flex flex-col items-end">
                  <span className="text-[10px] font-black text-white/60 uppercase tracking-widest">{user.displayName || 'User'}</span>
                  <button onClick={() => auth.signOut()} className="text-[8px] font-bold text-brand-cyan uppercase tracking-[0.2em] hover:text-brand-cyan/80 transition-colors">Sign Out</button>
                </div>
                <div className="relative p-0.5 rounded-full bg-gradient-to-tr from-brand-cyan to-brand-magenta">
                  <img src={user.photoURL || ''} alt="User" className="w-8 h-8 rounded-full bg-black" referrerPolicy="no-referrer" />
                </div>
              </div>
            ) : (
              <button 
                onClick={handleSignIn}
                className="flex items-center gap-2 px-6 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all bg-white/10 border border-white/20 text-white/60 hover:bg-brand-cyan hover:text-black hover:border-brand-cyan"
              >
                Sign In
              </button>
            )}

            <button 
              onClick={() => setShowSettings(true)}
              className={cn(
                "flex items-center gap-2 px-6 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all backdrop-blur-md border",
                userApiKey ? "bg-brand-cyan/10 border-brand-cyan/30 text-brand-cyan shadow-[0_0_15px_rgba(0,242,255,0.1)]" : "bg-white/5 border-white/10 text-white/40 hover:bg-white/10"
              )}
            >
              <Settings className="w-3.5 h-3.5" />
              {userApiKey ? "Personal Key Active" : "Set API Key"}
            </button>
          </div>
        </div>
      </nav>

      <main className="relative z-10 max-w-7xl mx-auto px-6 py-12 print:p-0 print:m-0 print:block">
        <div className="grid lg:grid-cols-12 gap-12 print:block">
          {/* Left Column: Controls */}
          <div className="lg:col-span-5 space-y-10">
            <motion.div 
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-6"
            >
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand-cyan/10 border border-brand-cyan/20 text-brand-cyan text-[10px] font-black uppercase tracking-[0.2em] glow-text">
                <Sparkles className="w-3.5 h-3.5 animate-pulse" />
                Artificial Intelligence Active
              </div>
              <h2 className="text-6xl font-black leading-[0.95] tracking-tighter italic uppercase glow-text">
                Neural <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-cyan via-brand-blue to-brand-magenta">Vision</span> System.
              </h2>
              <p className="text-white/40 text-lg leading-relaxed font-medium max-w-md">
                High-speed parallel processing for large-scale locomotive crew monitoring and compliance.
              </p>
              
              <div className="flex items-center gap-4 mt-8 pt-6 border-t border-white/10 w-max">
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-brand-cyan/10 border border-brand-cyan/30 shadow-[0_0_15px_rgba(0,242,255,0.15)] overflow-hidden relative">
                  <div className="absolute inset-0 bg-brand-cyan/20 animate-pulse-slow" />
                  <Cpu className="w-4 h-4 text-brand-cyan relative z-10" />
                </div>
                <div>
                  <p className="text-[8px] font-bold text-white/40 uppercase tracking-[0.4em] mb-0.5">Conceptualized & Designed By</p>
                  <p className="text-sm font-black tracking-[0.2em] uppercase text-brand-cyan glow-text">ADEE TRO BL</p>
                </div>
              </div>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="glass-card p-8 rounded-[2.5rem] relative overflow-hidden group ai-shimmer neon-glow-cyan"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-brand-cyan/10 blur-3xl rounded-full -mr-16 -mt-16 group-hover:bg-brand-cyan/20 transition-all" />
              
              <form onSubmit={handleSubmit} className="space-y-8 relative">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-brand-cyan mb-1">
                    <div className="w-1 h-1 rounded-full bg-brand-cyan animate-ping" />
                    <span className="text-[10px] font-bold uppercase tracking-widest">System Ready</span>
                  </div>
                  <h2 className="text-3xl font-black tracking-tight italic uppercase leading-none">Initialize <br />Analysis</h2>
                  <p className="text-sm text-white/40 font-medium">Upload neural data for deep processing</p>
                </div>

                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className={cn(
                    "group relative cursor-pointer overflow-hidden rounded-[2rem] border-2 border-dashed transition-all duration-500",
                    file ? "border-brand-cyan/40 bg-brand-cyan/10 shadow-[0_0_30px_rgba(0,242,255,0.1)]" : "border-white/5 hover:border-brand-cyan/30 hover:bg-white/[0.04]"
                  )}
                >
                  <input 
                    type="file" 
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept="video/*"
                    className="hidden"
                  />
                  <div className="p-12 flex flex-col items-center text-center gap-5">
                    {file ? (
                      <>
                        <div className="w-20 h-20 bg-brand-cyan/20 rounded-3xl flex items-center justify-center shadow-[0_0_40px_rgba(0,242,255,0.3)] border border-brand-cyan/30">
                          <CheckCircle2 className="w-10 h-10 text-brand-cyan" />
                        </div>
                        <div>
                          <p className="font-black text-white text-lg tracking-tight glow-text">{file.name}</p>
                          <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest mt-1">
                            {(file.size / (1024 * 1024)).toFixed(2)} MB • Neural Link Established
                          </p>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="w-20 h-20 bg-white/5 rounded-3xl flex items-center justify-center group-hover:scale-110 group-hover:bg-brand-cyan/10 transition-all duration-500 border border-white/5 group-hover:border-brand-cyan/30">
                          <Video className="w-10 h-10 text-white/40 group-hover:text-brand-cyan transition-colors" />
                        </div>
                        <div>
                          <p className="font-black text-white/80 text-lg tracking-tight group-hover:text-white transition-colors">Load CVVRS Footage</p>
                          <p className="text-[10px] font-bold text-white/60 uppercase tracking-widest mt-1">Optimized for large video files</p>
                          <p className="text-[9px] text-brand-cyan/60 font-black uppercase tracking-widest mt-3">Use standard MP4 (H.264) for best results</p>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase tracking-[0.3em] text-white/30 ml-1 flex items-center gap-2">
                      <Train className="w-3 h-3 text-brand-cyan" />
                      Loco Number (Manual)
                    </label>
                    <input 
                      type="text"
                      value={manualLocoNo}
                      onChange={(e) => setManualLocoNo(e.target.value)}
                      placeholder="e.g. WAG9-32451"
                      className="w-full px-6 py-4 rounded-2xl bg-white/[0.05] border border-white/10 focus:border-brand-cyan/40 focus:bg-white/[0.08] focus:ring-0 transition-all text-sm placeholder:text-white/40 font-medium"
                    />
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase tracking-[0.3em] text-white/60 ml-1 flex items-center gap-2">
                      <Clock className="w-3 h-3 text-brand-cyan" />
                      Date/Time (Optional)
                    </label>
                    <input 
                      type="text"
                      value={manualDateTime}
                      onChange={(e) => setManualDateTime(e.target.value)}
                      placeholder="e.g. 28/03/2026 10:00"
                      className="w-full px-6 py-4 rounded-2xl bg-white/[0.05] border border-white/10 focus:border-brand-cyan/40 focus:bg-white/[0.08] focus:ring-0 transition-all text-sm placeholder:text-white/50 font-medium"
                    />
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase tracking-[0.3em] text-white/60 ml-1 flex items-center gap-2">
                      <Train className="w-3 h-3 text-brand-cyan" />
                      Train No (Optional)
                    </label>
                    <input 
                      type="text"
                      value={trainNo}
                      onChange={(e) => setTrainNo(e.target.value)}
                      placeholder="e.g. 12951"
                      className="w-full px-6 py-4 rounded-2xl bg-white/[0.05] border border-white/10 focus:border-brand-cyan/40 focus:bg-white/[0.08] focus:ring-0 transition-all text-sm placeholder:text-white/50 font-medium"
                    />
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase tracking-[0.3em] text-white/60 ml-1 flex items-center gap-2">
                      <CheckCircle2 className="w-3 h-3 text-brand-cyan" />
                      Analyzer CLI Name
                    </label>
                    <input 
                      type="text"
                      value={analyzerCliName}
                      onChange={(e) => setAnalyzerCliName(e.target.value)}
                      placeholder="e.g. CLI R. Kumar"
                      className="w-full px-6 py-4 rounded-2xl bg-white/[0.05] border border-white/10 focus:border-brand-cyan/40 focus:bg-white/[0.08] focus:ring-0 transition-all text-sm placeholder:text-white/50 font-medium"
                    />
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase tracking-[0.3em] text-white/60 ml-1 flex items-center gap-2">
                      <Database className="w-3 h-3 text-brand-cyan" />
                      LP Name & HQ
                    </label>
                    <input 
                      type="text"
                      value={lpNameHQ}
                      onChange={(e) => setLpNameHQ(e.target.value)}
                      placeholder="e.g. Mukesh Kumar / BRC"
                      className="w-full px-6 py-4 rounded-2xl bg-white/[0.05] border border-white/10 focus:border-brand-cyan/40 focus:bg-white/[0.08] focus:ring-0 transition-all text-sm placeholder:text-white/50 font-medium"
                    />
                  </div>
                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase tracking-[0.3em] text-white/60 ml-1 flex items-center gap-2">
                      <Database className="w-3 h-3 text-brand-cyan" />
                      ALP Name & HQ
                    </label>
                    <input 
                      type="text"
                      value={alpNameHQ}
                      onChange={(e) => setAlpNameHQ(e.target.value)}
                      placeholder="e.g. Rahul Sharma / BRC"
                      className="w-full px-6 py-4 rounded-2xl bg-white/[0.05] border border-white/10 focus:border-brand-cyan/40 focus:bg-white/[0.08] focus:ring-0 transition-all text-sm placeholder:text-white/50 font-medium"
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase tracking-[0.3em] text-white/60 ml-1 flex items-center gap-2">
                    <MessageSquare className="w-3 h-3 text-brand-cyan" />
                    Neural Context & Corrections
                  </label>
                  <textarea 
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                    placeholder="If the previous result was wrong, provide corrections here..."
                    className="w-full h-28 px-6 py-5 rounded-[1.5rem] bg-white/[0.05] border border-white/10 focus:border-brand-cyan/40 focus:bg-white/[0.08] focus:ring-0 transition-all text-sm placeholder:text-white/50 resize-none font-medium"
                  />
                </div>

                {/* Neural Frame Buffer Gallery */}
                {extractedFrames.length > 0 && !loading && (
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-6 rounded-[2rem] bg-white/5 border border-white/10 backdrop-blur-md space-y-4"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Eye className="w-5 h-5 text-brand-cyan" />
                        <h3 className="text-sm font-black uppercase tracking-widest text-white/80 italic">Neural Frame Buffer</h3>
                      </div>
                      <span className="text-[10px] font-mono text-white/70">{extractedFrames.length} Frames Extracted</span>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-2">
                      {extractedFrames.map((frame, idx) => (
                        <div key={idx} className="relative group aspect-video rounded-xl overflow-hidden border border-white/10">
                          <img 
                            src={`data:${frame.mimeType};base64,${frame.data}`} 
                            alt={`Buffer Frame ${idx + 1}`}
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <button 
                              type="button"
                              onClick={() => removeFrameFromBuffer(idx)}
                              className="p-1.5 rounded-lg bg-red-500 text-white shadow-lg transform scale-90 group-hover:scale-100 transition-transform"
                              title="Delete Frame"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <div className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded-md bg-black/60 backdrop-blur-md text-[8px] font-black text-white/80">
                            #{idx + 1}
                          </div>
                        </div>
                      ))}
                    </div>
                    <p className="text-[9px] text-white/60 italic">Tip: Delete blurry or irrelevant frames to improve analysis accuracy. The system will automatically place one relevant photo below each non-compliance observation in the final report.</p>
                  </motion.div>
                )}

                <button
                  type="submit"
                  disabled={loading || !file}
                  className={cn(
                    "w-full py-6 rounded-[1.5rem] font-black text-xs uppercase tracking-[0.3em] transition-all flex items-center justify-center gap-4 group overflow-hidden relative",
                    loading || !user
                      ? "bg-white/5 text-white/40 cursor-not-allowed" 
                      : "bg-brand-cyan hover:bg-brand-cyan/90 text-black shadow-[0_0_30px_rgba(0,242,255,0.2)] active:scale-[0.98]"
                  )}
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                  {loading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Analyzing {progress}%
                    </>
                  ) : !user ? (
                    <>
                      <Lock className="w-5 h-5" />
                      Sign In to Analyze
                    </>
                  ) : (
                    <>
                      <Zap className="w-5 h-5 fill-current" />
                      Initiate Neural Scan
                    </>
                  )}
                </button>
              </form>
            </motion.div>

            {error && (
              <motion.div 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="p-6 rounded-[1.5rem] bg-red-500/10 border border-red-500/20 flex gap-4 items-start backdrop-blur-md"
              >
                <AlertCircle className="w-6 h-6 text-red-500 shrink-0 mt-0.5" />
                <p className="text-sm text-red-200/70 leading-relaxed font-medium">{error}</p>
              </motion.div>
            )}
          </div>

          {/* Right Column: Results */}
          <div className="lg:col-span-7 print:w-full print:p-0 print:m-0">
            <AnimatePresence mode="wait">
              {loading ? (
                <motion.div 
                  key="loading"
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 1.02 }}
                  className="h-full min-h-[650px] flex flex-col items-center justify-center text-center p-16 rounded-[3rem] bg-white/[0.01] border border-white/5 backdrop-blur-[80px] relative overflow-hidden"
                >
                  <div className="absolute inset-0 bg-gradient-to-b from-cyan-500/5 to-transparent" />
                  <NeuralFlow />
                  <div className="relative z-10">
                    <div className="relative inline-block">
                      <div className="w-40 h-40 rounded-full border-[6px] border-cyan-500/10 border-t-cyan-400 animate-spin" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Cpu className="w-14 h-14 text-cyan-400 animate-pulse" />
                      </div>
                    </div>
                    <h3 className="text-3xl font-black mt-10 mb-3 tracking-tight">Neural Processing</h3>
                    <p className="text-white/60 text-[11px] font-black uppercase tracking-[0.4em] h-6 flex items-center justify-center">
                      <AnimatePresence mode="wait">
                        <motion.span
                          key={retryStatus || loadingStep}
                          initial={{ opacity: 0, y: 5 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -5 }}
                        >
                          {retryStatus || loadingSteps[loadingStep]}
                        </motion.span>
                      </AnimatePresence>
                    </p>
                    
                    <div className="mt-16 space-y-4 w-full max-w-md mx-auto">
                      <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-white/50">
                        <span>{loadingMode === 'extracting' ? 'Extraction Progress' : 'Analysis Progress'}</span>
                        <div className="flex items-center gap-1">
                          {progress >= 95 && !retryStatus && <div className="w-1 h-1 bg-brand-cyan rounded-full animate-ping" />}
                          <span>{progress}%</span>
                        </div>
                      </div>
                      <div className="h-2 bg-white/5 rounded-full overflow-hidden p-0.5">
                        <motion.div 
                          className="h-full bg-cyan-500 rounded-full shadow-[0_0_15px_rgba(0,242,255,0.5)]"
                          initial={{ width: "0%" }}
                          animate={{ width: `${progress}%` }}
                          transition={progress >= 95 ? { repeat: Infinity, duration: 2, repeatType: "reverse" } : { duration: 0.5 }}
                        />
                      </div>
                      {progress >= 95 && (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="space-y-4"
                        >
                           <p className="text-white/30 text-[10px] uppercase tracking-widest italic animate-pulse">
                            Deep Neural Analysis is intensive. Still processing...
                          </p>
                          <button
                            onClick={() => window.location.reload()}
                            className="text-[10px] text-white/20 hover:text-white/60 transition-colors uppercase tracking-[0.3em] block mx-auto underline decoration-white/10 underline-offset-4"
                          >
                            System hanging? Force Restart
                          </button>
                        </motion.div>
                      )}
                    </div>
                  </div>
                </motion.div>
              ) : report ? (
                <motion.div 
                  key="report"
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-8 print:transform-none print:opacity-100 print:block print:static print:m-0 print:p-0"
                >
                      <div className="flex items-center justify-between px-2">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-brand-cyan/10 rounded-[1.2rem] flex items-center justify-center border border-brand-cyan/20">
                            <FileText className="w-6 h-6 text-brand-cyan" />
                          </div>
                          <div>
                            <h3 className="font-black text-xl tracking-tight italic glow-text uppercase print:text-black print:shadow-none flex items-center gap-3">
                              Intelligence Report
                              <span className="text-[8px] font-black text-brand-cyan/40 uppercase tracking-[0.2em] border border-brand-cyan/20 px-2 py-0.5 rounded-full bg-brand-cyan/5 italic no-print">Validated by CELE SIR</span>
                            </h3>
                            <p className="text-[10px] text-white/60 uppercase tracking-[0.3em] font-bold print:text-black/60 print:shadow-none">Neural Analysis Complete</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 no-print">
                          {extractedFrames.length > 0 && (
                            <div className="px-3 py-1.5 rounded-xl bg-brand-cyan/10 border border-brand-cyan/20 text-[9px] font-black text-brand-cyan uppercase tracking-[0.2em]">
                              {extractedFrames.length} Frames Buffered
                            </div>
                          )}
                          <button 
                            onClick={handlePrint}
                            className="flex items-center gap-2.5 px-6 py-3 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all text-[10px] font-black uppercase tracking-widest group glow-border"
                          >
                            <Printer className="w-4 h-4 text-brand-cyan group-hover:scale-110 transition-transform" />
                            Export PDF
                          </button>
                        </div>
                      </div>

                      <div className="p-1 rounded-[3rem] bg-gradient-to-br from-white/10 to-transparent shadow-2xl print:p-0 print:bg-none print:shadow-none print:rounded-none print:overflow-visible">
                        <div id="pdf-report-container" className="p-12 rounded-[2.9rem] glass-card border border-white/5 overflow-visible print:bg-white print:text-black print:p-0 print:border-0 print:shadow-none print:rounded-none print:overflow-visible print-container">
                          <div className="prose prose-invert prose-cyan max-w-none prose-headings:font-black prose-headings:tracking-tighter prose-headings:italic prose-p:text-white/60 prose-p:leading-relaxed prose-strong:text-white print:prose-invert-0 print:prose-p:text-black/80 print:prose-strong:text-black">
                            <Markdown 
                              remarkPlugins={[remarkGfm]}
                              components={{
                                p: ({ children }) => <p className="mb-4">{renderContentWithFrames(children)}</p>,
                                li: ({ children }) => <li className="mb-2">{renderContentWithFrames(children)}</li>,
                                td: ({ children }) => <td className="p-3 border border-white/10">{renderContentWithFrames(children)}</td>,
                                h1: ({ children }) => <h1 className="text-2xl font-bold mb-4">{renderContentWithFrames(children)}</h1>,
                                h2: ({ children }) => <h2 className="text-xl font-bold mb-3">{renderContentWithFrames(children)}</h2>,
                                h3: ({ children }) => <h3 className="text-lg font-bold mb-2">{renderContentWithFrames(children)}</h3>,
                                code: ({ children }) => <code className="bg-white/5 px-1 rounded">{renderContentWithFrames(children)}</code>,
                                strong: ({ children }) => <strong className="font-bold text-white">{renderContentWithFrames(children)}</strong>,
                                em: ({ children }) => <em className="italic">{renderContentWithFrames(children)}</em>,
                              }}
                            >
                              {report + (userDeviationReport ? `\n\n---\n\n### User Deviation / AI Error Report\n\n${userDeviationReport}` : "")}
                            </Markdown>
                            
                            <div className="mt-16 pt-8 border-t border-black/5 italic text-black/40 text-[10px] tracking-widest uppercase font-black print:block hidden">
                              Neural Safety Division • Western Railway
                            </div>
                          </div>
                        </div>
                      </div>

                      <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="p-8 rounded-[2.5rem] glass-card border border-white/5 space-y-6 no-print"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-brand-magenta/10 rounded-2xl flex items-center justify-center border border-brand-magenta/20">
                            <AlertCircle className="w-5 h-5 text-brand-magenta" />
                          </div>
                          <div>
                            <h4 className="font-black text-sm tracking-tight uppercase italic text-white/80">User Deviation Report</h4>
                            <p className="text-[10px] text-white/60 uppercase tracking-widest font-bold">Add manual observations or AI error reports</p>
                          </div>
                        </div>
                        <textarea
                          value={userDeviationReport}
                          onChange={(e) => setUserDeviationReport(e.target.value)}
                          placeholder="Enter any manual observations or AI errors here. This will be appended to the final Intelligence Report at the end."
                          className="w-full min-h-[120px] p-6 rounded-3xl bg-white/[0.05] border border-white/20 focus:border-brand-magenta/50 focus:ring-1 focus:ring-brand-magenta/50 transition-all outline-none text-sm text-white/90 placeholder:text-white/40 resize-none custom-scrollbar"
                        />
                      </motion.div>
                </motion.div>
              ) : (
                  <motion.div 
                    key="empty"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="h-full min-h-[650px] flex flex-col items-center justify-center text-center p-16 rounded-[3rem] border-2 border-dashed border-white/5 glass-card"
                  >
                    <div className="w-24 h-24 bg-white/[0.02] rounded-[2rem] flex items-center justify-center mb-8 border border-white/5 relative group">
                      <div className="absolute inset-0 bg-brand-cyan/20 blur-xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
                      <Eye className="w-12 h-12 text-white/30 group-hover:text-brand-cyan transition-colors" />
                    </div>
                    <h3 className="text-2xl font-black text-white/60 italic tracking-tight uppercase glow-text">Neural Standby</h3>
                    <p className="text-white/40 text-sm max-w-xs mt-3 font-medium">
                      Load CVVRS footage to begin high-speed automated intelligence analysis.
                    </p>
                    
                    <div className="mt-16 grid grid-cols-2 gap-6 w-full max-w-md">
                      <div className="p-6 rounded-[2rem] glass-card border border-white/5 text-left group hover:bg-white/[0.04] transition-all glow-border">
                        <Activity className="w-6 h-6 text-brand-cyan/40 mb-4 group-hover:scale-110 transition-transform" />
                        <p className="text-[9px] uppercase tracking-[0.3em] text-white/50 font-black">Fast Engine</p>
                        <p className="text-xs text-white/40 mt-2 font-medium leading-relaxed">Multi-frame parallel processing logic</p>
                      </div>
                      <div className="p-6 rounded-[2rem] glass-card border border-white/5 text-left group hover:bg-white/[0.04] transition-all glow-border">
                        <ShieldAlert className="w-6 h-6 text-brand-magenta/40 mb-4 group-hover:scale-110 transition-transform" />
                        <p className="text-[9px] uppercase tracking-[0.3em] text-white/50 font-black">Compliance</p>
                        <p className="text-xs text-white/40 mt-2 font-medium leading-relaxed">Strict Indian Railway rulebook adherence</p>
                      </div>
                    </div>
                  </motion.div>
              )}
            </AnimatePresence>

            {/* Past Global Corrections Section */}
            <div className="mt-12 space-y-6 glass-card p-8 rounded-[2.5rem] relative overflow-hidden ai-shimmer neon-glow-magenta">
              <div className="absolute bottom-0 left-0 w-48 h-48 bg-brand-magenta/10 blur-3xl rounded-full -ml-24 -mb-24" />
              
              <div className="flex items-center justify-between px-2 relative">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-brand-cyan/10 rounded-lg border border-brand-cyan/20">
                    <History className="w-5 h-5 text-brand-cyan" />
                  </div>
                  <h3 className="text-lg font-black tracking-tight italic uppercase glow-text">Neural Learning History</h3>
                </div>
                {user && (
                  <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-green-500/10 border border-green-500/20 shadow-[0_0_15px_rgba(34,197,94,0.1)]">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-[8px] font-black text-green-500 uppercase tracking-widest">Live Sync Active</span>
                  </div>
                )}
              </div>

              {firebaseError && (
                <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-[10px] text-red-400 font-bold uppercase tracking-widest flex items-center gap-3">
                  <AlertCircle className="w-4 h-4" />
                  {firebaseError}
                </div>
              )}

              {!isAuthReady ? (
                <div className="h-20 flex items-center justify-center">
                  <Loader2 className="w-6 h-6 text-white/30 animate-spin" />
                </div>
              ) : !user ? (
                <div className="p-10 rounded-[2rem] border-2 border-dashed border-white/5 bg-white/[0.01] text-center space-y-4">
                  <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-2">
                    <ShieldAlert className="w-6 h-6 text-white/50" />
                  </div>
                  <p className="text-xs text-white/40 font-black uppercase tracking-widest">Authentication Required</p>
                  <p className="text-[10px] text-white/50 font-medium max-w-[200px] mx-auto">Sign in to sync your analysis with the global neural network.</p>
                  <button 
                    onClick={handleSignIn}
                    className="px-8 py-3 rounded-xl bg-cyan-600 text-white text-[10px] font-black uppercase tracking-widest hover:bg-cyan-50 hover:text-black transition-all shadow-xl shadow-cyan-600/20"
                  >
                    Sign In with Google
                  </button>
                </div>
              ) : pastCorrections.length === 0 ? (
                <div className="p-10 rounded-[2rem] border-2 border-dashed border-white/5 bg-white/[0.01] text-center">
                  <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Database className="w-6 h-6 text-white/30" />
                  </div>
                  <p className="text-xs text-white/50 font-black uppercase tracking-widest">No global corrections recorded yet</p>
                  <p className="text-[10px] text-white/40 mt-2 font-medium">AI will learn from your first correction</p>
                </div>
              ) : (
                <div className="grid gap-4 max-h-[500px] overflow-y-auto pr-4 custom-scrollbar">
                  {pastCorrections.map((item, idx) => (
                    <motion.div 
                      key={idx} 
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className="p-6 rounded-[1.5rem] glass-card border border-white/5 hover:border-brand-cyan/30 hover:bg-white/[0.05] transition-all group relative overflow-hidden glow-border"
                    >
                      <div className="absolute top-0 left-0 w-1 h-full bg-brand-cyan/20 group-hover:bg-brand-cyan transition-colors" />
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-black text-brand-cyan uppercase tracking-widest glow-text">Global Node #{pastCorrections.length - idx}</span>
                        </div>
                        <span className="text-[9px] font-bold text-white/50 uppercase tracking-widest">
                          {new Date(item.timestamp).toLocaleDateString()} • {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-xs text-white/80 font-medium leading-relaxed italic mb-3">
                        "{item.context}"
                      </p>
                      <div className="flex items-center gap-2 text-[10px] font-black text-white/40 uppercase tracking-widest bg-white/5 p-3 rounded-lg border border-white/5">
                        <ChevronRight className="w-3 h-3 text-brand-cyan" />
                        <span className="truncate">AI Learned: {item.correction.substring(0, 80)}...</span>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      <footer className="relative z-10 border-t border-white/5 py-16 mt-16 bg-black/60 backdrop-blur-2xl">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-10">
          <div className="flex items-center gap-3 opacity-30 group cursor-pointer">
            <ShieldAlert className="w-6 h-6 group-hover:text-cyan-500 transition-colors" />
            <span className="text-lg font-black tracking-tighter italic">CVVRS AI</span>
          </div>
          <div className="flex flex-col items-center md:items-start gap-2">
            <p className="text-white/40 text-[10px] tracking-[0.4em] uppercase font-black text-center md:text-left">
              © 2026 Indian Railways • CELE SIR • Neural Safety Division • V4.0.2
            </p>
            <p className="text-brand-cyan/40 text-[8px] tracking-[0.2em] uppercase font-black italic">
              Designed under the visionary guidance and intelligent expertise of CELE SIR
            </p>
          </div>
          <div className="flex gap-8">
            <a href="#" className="text-white/40 hover:text-cyan-500/50 transition-all"><Zap className="w-6 h-6" /></a>
            <a href="#" className="text-white/40 hover:text-magenta-500/50 transition-all"><Cpu className="w-6 h-6" /></a>
            <a href="#" className="text-white/40 hover:text-magenta-500/50 transition-all"><History className="w-6 h-6" /></a>
          </div>
        </div>
      </footer>

      <AnimatePresence>
        {showSettings && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSettings(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-xl"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-lg p-1 rounded-[2.5rem] bg-gradient-to-br from-white/10 to-transparent shadow-2xl"
            >
              <div className="p-10 rounded-[2.4rem] bg-black/90 border border-white/10 space-y-8">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-cyan-500/10 rounded-2xl flex items-center justify-center border border-cyan-500/20">
                      <Settings className="w-6 h-6 text-cyan-400" />
                    </div>
                    <div>
                      <h3 className="text-xl font-black tracking-tight italic">API Configuration</h3>
                      <p className="text-[10px] text-white/60 uppercase tracking-[0.3em] font-bold">Personalize Neural Engine</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setShowSettings(false)}
                    className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 transition-all"
                  >
                    <X className="w-5 h-5 text-white/40" />
                  </button>
                </div>

                <div className="space-y-6">
                  <div className="p-6 rounded-2xl bg-cyan-500/5 border border-cyan-500/10 space-y-3">
                    <p className="text-xs text-cyan-400/80 leading-relaxed font-medium">
                      Enter your personal Gemini API key or Admin Password. Your configuration is stored locally in your browser.
                    </p>
                    <div className="flex flex-wrap gap-4">
                      <a 
                        href="https://aistudio.google.com/app/apikey" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-[10px] font-black text-cyan-400 uppercase tracking-widest hover:underline"
                      >
                        Get Free API Key <ChevronRight className="w-3 h-3" />
                      </a>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase tracking-[0.3em] text-white/30 ml-1">
                      Gemini API Key / Admin Password
                    </label>
                    <input 
                      type="password"
                      value={userApiKey}
                      onChange={(e) => setUserApiKey(e.target.value)}
                      placeholder="Enter Key or Admin Password..."
                      className="w-full px-6 py-4 rounded-2xl bg-white/[0.03] border border-white/10 focus:border-cyan-500/40 focus:bg-white/[0.05] focus:ring-0 transition-all text-sm font-mono"
                    />
                  </div>

                  <div className="flex gap-4">
                    <button 
                      onClick={() => saveApiKey(userApiKey)}
                      className="flex-1 py-4 bg-cyan-600 hover:bg-cyan-500 text-white rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] transition-all shadow-lg shadow-cyan-600/20"
                    >
                      Save Configuration
                    </button>
                    <button 
                      onClick={() => {
                        setUserApiKey("");
                        localStorage.removeItem("CVVRS_USER_API_KEY");
                        setShowSettings(false);
                      }}
                      className="px-6 py-4 bg-white/5 hover:bg-red-500/10 hover:text-red-500 text-white/40 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] transition-all border border-white/5"
                    >
                      Reset
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
    </ErrorBoundary>
  );
}
