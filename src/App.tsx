import { useState, useRef, useEffect } from "react";
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
  Database
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import Markdown from "react-markdown";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { GoogleGenAI } from "@google/genai";
import { auth, db, signInWithGoogle } from "./firebase";
import { collection, addDoc, query, orderBy, limit, onSnapshot } from "firebase/firestore";
import { onAuthStateChanged, User } from "firebase/auth";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { handleFirestoreError, OperationType } from "./lib/firestoreUtils";

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
Detect "Running Condition" by observing relative motion between the locomotive and the surrounding environment/fixtures.
When the train is in motion, check the following: LP AND APL WEAR SKY BLUE SHIRT AND NAVY BLUE TROUSER SO MAKE REPORT ONLY OF THAT DRESS CODE STAFF. BUT IN WINTER HE MAY WEAR JACKET.
1. Signal Calling: Is the crew calling out signal aspects with the proper confirmed hand gesture?
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
Detect "Stationary Condition" by the lack of relative motion between the locomotive and the surrounding environment.
When the train is stopped, check the following:
1. Loco Check (ALP): Is the ALP getting down from the cab to check the locomotive (under-gear/equipment)?
2. SA-9 Application: Is the Loco Pilot applying the SA-9 (Independent Brake) when the train comes to a halt?
3. Reverser Neutral: Is the Loco Pilot keeping the reverser switch in the Neutral position?
4. Nap/Micro-Sleep: Is the crew taking a nap or showing signs of micro-sleep?

C. Report Structure & Formatting
The final output must be a structured report with the following elements:
1. Heading: CVVRS Intelligence Analysis Report
2. Subheadings:
   - Locomotive ID: [Detected ID]
   - Date of Recording: [Detected Date]
   - Observation Period: [Start Time] to [End Time]
3. Detailed Analysis: Provide a topic-wise detailed analysis of the observations.
4. Compliance Table: Provide a table in the exact format below:
   Timestamp (Video Clock) | Timestamp (Video Streaming) | Activity Category | Compliance Status | Deviation Description
   [Time] | [Time] | [Category] | [Compliant/Non-Compliant] | [Details]

D. Disciplinary Summary
Based on the observations, provide a summary of:
- Corrective Measures: (e.g., Counseling, Refresher Training).
- Charge Sheet & Punishment: (e.g., Major/Minor penalty based on the severity of the violation, such as mobile use or sleeping, in accordance with DAR norms).

Constraints:
- Prioritize accuracy over speed.
- Utilize previous user corrections regarding terminology (e.g., use "Driving Desk" instead of "Control Stand").
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
  const [error, setError] = useState<string | null>(null);
  const [loadingStep, setLoadingStep] = useState(0);
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

  const loadingSteps = [
    "Initializing Neural Engine...",
    "Extracting High-Resolution Frames...",
    "Detecting Crew Activities...",
    "Analyzing Compliance Standards...",
    "Generating CVVRS Intelligence Report...",
    "Finalizing Disciplinary Summary..."
  ];

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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError(null);
      setReport(null);
      setProgress(0);
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
          // For very long videos, we cap the number of frames to 15 for speed
          const step = Math.max(intervalSeconds, duration / 15); 

          for (let time = 0; time < duration; time += step) {
            setProgress(Math.round((time / duration) * 100));
            
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
            
            if (frames.length >= 15) break;
          }

          cleanup();
          resolve(frames);
        } catch (err) {
          cleanup();
          reject(err);
        }
      };

      video.onerror = () => {
        let errorMsg = video.error ? `${video.error.message} (Code: ${video.error.code})` : "Unknown video error";
        
        // Specific advice for Code 4 (Demuxer error / Unsupported format)
        if (video.error?.code === 4 || errorMsg.includes("DEMUXER_ERROR")) {
          errorMsg = "The video format is not natively supported by your browser's engine. CVVRS systems often use specialized codecs. Please convert the video to a standard MP4 (H.264) format using a tool like Handbrake or VLC before uploading.";
        }
        
        cleanup();
        reject(new Error(`Failed to load video for frame extraction: ${errorMsg}`));
      };
    });
  };

  const generateContentWithRetry = async (ai: GoogleGenAI, params: any, maxRetries = 3) => {
    let lastError: any;
    for (let i = 0; i < maxRetries; i++) {
      try {
        const response = await ai.models.generateContent(params);
        return response;
      } catch (err: any) {
        lastError = err;
        const errorMessage = err.message || "";
        const isRetryable = 
          errorMessage.includes("503") || 
          errorMessage.toLowerCase().includes("overloaded") || 
          errorMessage.toLowerCase().includes("high demand") ||
          errorMessage.toLowerCase().includes("unavailable") ||
          errorMessage.toLowerCase().includes("deadline exceeded");
        
        if (isRetryable && i < maxRetries - 1) {
          const delay = Math.pow(2, i) * 3000 + Math.random() * 1000;
          console.warn(`Neural engine overloaded (503), retrying in ${Math.round(delay)}ms... (Attempt ${i + 1}/${maxRetries})`);
          // Update loading step to show retry status
          setLoadingStep(loadingSteps.length - 1); // Point to a generic "Finalizing" or similar if needed, or just keep current
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        throw err;
      }
    }
    throw lastError;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setError("Please select a CVVRS video file first.");
      return;
    }

    setLoading(true);
    setReport(null);
    setError(null);
    setProgress(0);

    try {
      // Check if the entered key is actually the admin password
      const adminPassword = process.env.ADMIN_PASSWORD;
      let apiKey = userApiKey;

      if (adminPassword && userApiKey === adminPassword) {
        apiKey = process.env.GEMINI_API_KEY || "";
      }

      if (!apiKey) {
        setShowSettings(true);
        throw new Error("Personal API Key Required: To protect system quota, every user must provide their own Gemini API key. If you are the owner, please enter your Admin Password.");
      }

      const ai = new GoogleGenAI({ apiKey });
      
      // Extract frames instead of sending the whole video for speed and large file support
      const frames = await extractFrames(file);
      
      // 3. Prepare Neural Prompt with Global Learning
      const learningContext = pastCorrections.length > 0 
        ? `\nPAST GLOBAL CORRECTIONS (Learn from these mistakes across all users): ${pastCorrections.map(c => `[Context: ${c.context}] -> Correction: ${c.correction}`).join('; ')}`
        : "";

      const promptWithFeedback = feedback 
        ? `${MASTER_PROMPT}\n\nAdditional User Feedback to consider: ${feedback}${learningContext}`
        : `${MASTER_PROMPT}${learningContext}`;

      const response = await generateContentWithRetry(ai, {
        model: "gemini-3-flash-preview",
        contents: [
          {
            parts: [
              ...frames.map(frame => ({ inlineData: frame })),
              { text: promptWithFeedback }
            ]
          }
        ]
      });

      if (!response.text) {
        throw new Error("AI failed to generate a report. Please try again with a different video.");
      }

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
        errorMessage = "AI Quota Exceeded: The system is currently handling too many requests. Please wait about 30-60 seconds and try again. Switching to a faster engine for your next attempt.";
      } else if (errorMessage.includes("503") || errorMessage.toLowerCase().includes("high demand") || errorMessage.toLowerCase().includes("unavailable")) {
        errorMessage = "Neural Engine Overloaded: Google's AI models are currently experiencing extremely high demand globally. We attempted several retries, but the service is still unavailable. Please wait a minute and try again.";
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
      setProgress(100);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-[#050505] text-white font-sans selection:bg-cyan-500/30 overflow-x-hidden">
      {/* Atmospheric Background */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-cyan-600/10 blur-[160px] rounded-full animate-pulse" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[70%] h-[70%] bg-magenta-600/10 blur-[200px] rounded-full animate-pulse" style={{ animationDelay: '3s' }} />
        <div className="absolute top-[30%] right-[20%] w-[40%] h-[40%] bg-cyan-600/5 blur-[140px] rounded-full" />
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1677442136019-21780ecad995?q=80&w=1932&auto=format&fit=crop')] bg-cover bg-center opacity-[0.05] mix-blend-overlay" />
      </div>

      {/* Navigation */}
      <nav className="relative z-10 border-b border-white/5 backdrop-blur-2xl bg-black/40 sticky top-0">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-cyan-500 to-cyan-700 rounded-2xl flex items-center justify-center shadow-2xl shadow-cyan-600/30 group cursor-pointer">
              <ShieldAlert className="w-7 h-7 text-white group-hover:scale-110 transition-transform" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tighter uppercase italic">CVVRS <span className="text-cyan-400">AI</span></h1>
              <p className="text-[9px] uppercase tracking-[0.3em] text-white/30 font-bold">Crew Intelligence System</p>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-10">
            <a href="#" className="text-xs font-bold uppercase tracking-widest text-white/40 hover:text-white transition-all">Neural Engine</a>
            <a href="#" className="text-xs font-bold uppercase tracking-widest text-white/40 hover:text-white transition-all">Compliance</a>
            
            {user ? (
              <div className="flex items-center gap-4">
                <div className="flex flex-col items-end">
                  <span className="text-[10px] font-black text-white/60 uppercase tracking-widest">{user.displayName || 'User'}</span>
                  <button onClick={() => auth.signOut()} className="text-[8px] font-bold text-cyan-500 uppercase tracking-[0.2em] hover:text-cyan-400">Sign Out</button>
                </div>
                <img src={user.photoURL || ''} alt="User" className="w-8 h-8 rounded-full border border-white/10" referrerPolicy="no-referrer" />
              </div>
            ) : (
              <button 
                onClick={handleSignIn}
                className="flex items-center gap-2 px-6 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all bg-white/5 border border-white/10 text-white/40 hover:bg-white/10"
              >
                Sign In
              </button>
            )}

            <button 
              onClick={() => setShowSettings(true)}
              className={cn(
                "flex items-center gap-2 px-6 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all backdrop-blur-md border",
                userApiKey ? "bg-cyan-500/10 border-cyan-500/30 text-cyan-400" : "bg-white/5 border-white/10 text-white/40 hover:bg-white/10"
              )}
            >
              <Settings className="w-3.5 h-3.5" />
              {userApiKey ? "Personal Key Active" : "Set API Key"}
            </button>
          </div>
        </div>
      </nav>

      <main className="relative z-10 max-w-7xl mx-auto px-6 py-16">
        <div className="grid lg:grid-cols-12 gap-16">
          {/* Left Column: Controls */}
          <div className="lg:col-span-5 space-y-10">
            <motion.div 
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-6"
            >
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-[10px] font-black uppercase tracking-[0.2em]">
                <Sparkles className="w-3.5 h-3.5" />
                Artificial Intelligence
              </div>
              <h2 className="text-6xl font-black leading-[0.95] tracking-tighter italic">
                CVVRS <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-cyan-500 to-cyan-600">Analysis</span> by AI.
              </h2>
              <p className="text-white/40 text-lg leading-relaxed font-medium">
                High-speed neural vision for large-scale locomotive crew monitoring. Optimized for CVVRS data processing.
              </p>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="p-1 rounded-[2.5rem] bg-gradient-to-br from-white/10 to-transparent shadow-2xl"
            >
              <div className="p-10 rounded-[2.4rem] bg-black/60 backdrop-blur-[60px] border border-white/5 space-y-8">
                <form onSubmit={handleSubmit} className="space-y-8">
                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase tracking-[0.3em] text-white/30 ml-1 flex items-center gap-2">
                      <Database className="w-3 h-3" />
                      Data Source
                    </label>
                    <div 
                      onClick={() => fileInputRef.current?.click()}
                      className={cn(
                        "group relative cursor-pointer overflow-hidden rounded-[2rem] border-2 border-dashed transition-all duration-500",
                        file ? "border-cyan-500/40 bg-cyan-500/5 shadow-[inset_0_0_40px_rgba(0,242,255,0.05)]" : "border-white/5 hover:border-white/20 hover:bg-white/[0.02]"
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
                            <div className="w-20 h-20 bg-cyan-500/20 rounded-3xl flex items-center justify-center shadow-2xl shadow-cyan-500/20">
                              <CheckCircle2 className="w-10 h-10 text-cyan-400" />
                            </div>
                            <div>
                              <p className="font-black text-white text-lg tracking-tight">{file.name}</p>
                              <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest mt-1">
                                {(file.size / (1024 * 1024)).toFixed(2)} MB • Large File Support Active
                              </p>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="w-20 h-20 bg-white/5 rounded-3xl flex items-center justify-center group-hover:scale-110 group-hover:bg-white/10 transition-all duration-500">
                              <Video className="w-10 h-10 text-white/20 group-hover:text-white/40 transition-colors" />
                            </div>
                            <div>
                              <p className="font-black text-white/80 text-lg tracking-tight">Load CVVRS Footage</p>
                              <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest mt-1">Optimized for large video files</p>
                              <p className="text-[9px] text-cyan-500/60 font-black uppercase tracking-widest mt-3">Use standard MP4 (H.264) for best results</p>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                    <div className="space-y-3">
                      <label className="text-[10px] font-black uppercase tracking-[0.3em] text-white/30 ml-1 flex items-center gap-2">
                        <MessageSquare className="w-3 h-3" />
                        Neural Context & Corrections
                      </label>
                      <textarea 
                        value={feedback}
                        onChange={(e) => setFeedback(e.target.value)}
                        placeholder="If the previous result was wrong, provide corrections here (e.g., 'The LP was alert, not sleeping') or specify unique conditions..."
                        className="w-full h-28 px-6 py-5 rounded-[1.5rem] bg-white/[0.03] border border-white/5 focus:border-cyan-500/40 focus:bg-white/[0.05] focus:ring-0 transition-all text-sm placeholder:text-white/10 resize-none font-medium"
                      />
                    </div>
  
                    <button
                      type="submit"
                      disabled={loading || !file}
                      className={cn(
                        "w-full py-6 rounded-[1.5rem] font-black text-xs uppercase tracking-[0.3em] transition-all flex items-center justify-center gap-4 group overflow-hidden relative",
                        loading 
                          ? "bg-white/5 text-white/20 cursor-not-allowed" 
                          : "bg-cyan-600 hover:bg-cyan-500 text-white shadow-2xl shadow-cyan-600/30 active:scale-[0.98]"
                      )}
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                      {loading ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          Analyzing {progress}%
                        </>
                      ) : (
                        <>
                          <Zap className="w-5 h-5 fill-current" />
                          Initiate Fast Analysis
                        </>
                      )}
                    </button>
                </form>
              </div>
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
          <div className="lg:col-span-7">
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
                    <p className="text-white/30 text-[11px] font-black uppercase tracking-[0.4em] h-6">
                      {loadingSteps[loadingStep]}
                    </p>
                    
                    <div className="mt-16 space-y-4 w-full max-w-md mx-auto">
                      <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-white/20">
                        <span>Extraction Progress</span>
                        <span>{progress}%</span>
                      </div>
                      <div className="h-2 bg-white/5 rounded-full overflow-hidden p-0.5">
                        <motion.div 
                          className="h-full bg-cyan-500 rounded-full shadow-[0_0_15px_rgba(0,242,255,0.5)]"
                          initial={{ width: "0%" }}
                          animate={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </motion.div>
              ) : report ? (
                <motion.div 
                  key="report"
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-8"
                >
                      <div className="flex items-center justify-between px-2">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-cyan-500/10 rounded-[1.2rem] flex items-center justify-center border border-cyan-500/20">
                            <FileText className="w-6 h-6 text-cyan-400" />
                          </div>
                          <div>
                            <h3 className="font-black text-xl tracking-tight italic">Intelligence Report</h3>
                            <p className="text-[10px] text-white/30 uppercase tracking-[0.3em] font-bold">Neural Analysis Complete</p>
                          </div>
                        </div>
                        <div className="flex gap-3">
                          <button 
                            onClick={handlePrint}
                            className="flex items-center gap-2.5 px-6 py-3 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all text-[10px] font-black uppercase tracking-widest group"
                          >
                            <Printer className="w-4 h-4 text-cyan-400 group-hover:scale-110 transition-transform" />
                            Export PDF
                          </button>
                        </div>
                      </div>

                      <div className="p-1 rounded-[3rem] bg-gradient-to-br from-white/10 to-transparent shadow-2xl">
                        <div className="p-12 rounded-[2.9rem] bg-black/60 backdrop-blur-[60px] border border-white/5 overflow-hidden print:bg-white print:text-black print:p-0 print:border-0 print:shadow-none">
                          <div className="prose prose-invert prose-cyan max-w-none prose-headings:font-black prose-headings:tracking-tighter prose-headings:italic prose-p:text-white/60 prose-p:leading-relaxed prose-strong:text-white prose-table:border-white/5 prose-th:text-white/20 prose-th:uppercase prose-th:text-[9px] prose-th:tracking-[0.3em] prose-th:font-black prose-td:text-white/50 prose-td:text-sm print:prose-invert-0 print:prose-p:text-black/80 print:prose-strong:text-black print:prose-td:text-black">
                            <Markdown>{report}</Markdown>
                          </div>
                        </div>
                      </div>
                </motion.div>
              ) : (
                <motion.div 
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="h-full min-h-[650px] flex flex-col items-center justify-center text-center p-16 rounded-[3rem] border-2 border-dashed border-white/5 bg-white/[0.01] backdrop-blur-sm"
                >
                  <div className="w-24 h-24 bg-white/[0.02] rounded-[2rem] flex items-center justify-center mb-8 border border-white/5">
                    <Eye className="w-12 h-12 text-white/10" />
                  </div>
                  <h3 className="text-2xl font-black text-white/40 italic tracking-tight">Neural Standby</h3>
                  <p className="text-white/20 text-sm max-w-xs mt-3 font-medium">
                    Load CVVRS footage to begin high-speed automated intelligence analysis.
                  </p>
                  
                  <div className="mt-16 grid grid-cols-2 gap-6 w-full max-w-md">
                    <div className="p-6 rounded-[2rem] bg-white/[0.02] border border-white/5 text-left group hover:bg-white/[0.04] transition-all">
                      <Activity className="w-6 h-6 text-cyan-400/40 mb-4 group-hover:scale-110 transition-transform" />
                      <p className="text-[9px] uppercase tracking-[0.3em] text-white/20 font-black">Fast Engine</p>
                      <p className="text-xs text-white/40 mt-2 font-medium leading-relaxed">Multi-frame parallel processing logic</p>
                    </div>
                    <div className="p-6 rounded-[2rem] bg-white/[0.02] border border-white/5 text-left group hover:bg-white/[0.04] transition-all">
                      <ShieldAlert className="w-6 h-6 text-magenta-500/40 mb-4 group-hover:scale-110 transition-transform" />
                      <p className="text-[9px] uppercase tracking-[0.3em] text-white/20 font-black">Compliance</p>
                      <p className="text-xs text-white/40 mt-2 font-medium leading-relaxed">Strict Indian Railway rulebook adherence</p>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Past Global Corrections Section */}
            <div className="mt-12 space-y-6 bg-white/[0.02] p-8 rounded-[2.5rem] border border-white/5 backdrop-blur-md">
              <div className="flex items-center justify-between px-2">
                <div className="flex items-center gap-3">
                  <History className="w-5 h-5 text-cyan-400" />
                  <h3 className="text-lg font-black tracking-tight italic uppercase">Neural Learning History</h3>
                </div>
                {user && (
                  <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-green-500/10 border border-green-500/20">
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
                  <Loader2 className="w-6 h-6 text-white/10 animate-spin" />
                </div>
              ) : !user ? (
                <div className="p-10 rounded-[2rem] border-2 border-dashed border-white/5 bg-white/[0.01] text-center space-y-4">
                  <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-2">
                    <ShieldAlert className="w-6 h-6 text-white/20" />
                  </div>
                  <p className="text-xs text-white/40 font-black uppercase tracking-widest">Authentication Required</p>
                  <p className="text-[10px] text-white/20 font-medium max-w-[200px] mx-auto">Sign in to sync your analysis with the global neural network.</p>
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
                    <Database className="w-6 h-6 text-white/10" />
                  </div>
                  <p className="text-xs text-white/20 font-black uppercase tracking-widest">No global corrections recorded yet</p>
                  <p className="text-[10px] text-white/10 mt-2 font-medium">AI will learn from your first correction</p>
                </div>
              ) : (
                <div className="grid gap-4 max-h-[500px] overflow-y-auto pr-4 custom-scrollbar">
                  {pastCorrections.map((item, idx) => (
                    <motion.div 
                      key={idx} 
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className="p-6 rounded-[1.5rem] bg-white/[0.03] border border-white/5 hover:border-cyan-500/30 hover:bg-white/[0.05] transition-all group relative overflow-hidden"
                    >
                      <div className="absolute top-0 left-0 w-1 h-full bg-cyan-500/20 group-hover:bg-cyan-500 transition-colors" />
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-black text-cyan-500 uppercase tracking-widest">Global Node #{pastCorrections.length - idx}</span>
                        </div>
                        <span className="text-[9px] font-bold text-white/20 uppercase tracking-widest">
                          {new Date(item.timestamp).toLocaleDateString()} • {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-xs text-white/80 font-medium leading-relaxed italic mb-3">
                        "{item.context}"
                      </p>
                      <div className="flex items-center gap-2 text-[10px] font-black text-white/40 uppercase tracking-widest bg-white/5 p-3 rounded-lg border border-white/5">
                        <ChevronRight className="w-3 h-3 text-cyan-400" />
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
          <p className="text-white/10 text-[10px] tracking-[0.4em] uppercase font-black">
            © 2026 Indian Railways • Neural Safety Division • V4.0.2
          </p>
          <div className="flex gap-8">
            <a href="#" className="text-white/10 hover:text-cyan-500/50 transition-all"><Zap className="w-6 h-6" /></a>
            <a href="#" className="text-white/10 hover:text-magenta-500/50 transition-all"><Cpu className="w-6 h-6" /></a>
            <a href="#" className="text-white/10 hover:text-magenta-500/50 transition-all"><History className="w-6 h-6" /></a>
          </div>
        </div>
      </footer>

      {/* Settings Modal */}
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
                      <p className="text-[10px] text-white/30 uppercase tracking-[0.3em] font-bold">Personalize Neural Engine</p>
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
