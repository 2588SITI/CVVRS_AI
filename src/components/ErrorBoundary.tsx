import React, { Component, ErrorInfo, ReactNode } from 'react';

// Force Vite update
interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      let errorMessage = "Something went wrong.";
      
      try {
        // Check if it's a Firestore JSON error
        const parsed = JSON.parse(this.state.error?.message || "");
        if (parsed.error && parsed.operationType) {
          errorMessage = `Database Error: ${parsed.operationType} failed on ${parsed.path}. Please check permissions.`;
        }
      } catch (e) {
        // Not a JSON error
        errorMessage = this.state.error?.message || errorMessage;
      }

      return (
        <div className="min-h-screen bg-[#050505] flex items-center justify-center p-6 text-center">
          <div className="max-w-md w-full space-y-6 border border-white/10 bg-white/5 p-8 rounded-2xl backdrop-blur-xl">
            <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto border border-red-500/30">
              <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="text-xl font-black text-white uppercase tracking-widest">System Alert</h2>
            <p className="text-white/60 text-sm font-medium leading-relaxed">
              {errorMessage}
            </p>
            <button 
              onClick={() => window.location.reload()}
              className="w-full py-3 bg-white text-black font-black uppercase tracking-widest text-[10px] rounded-full hover:bg-cyan-400 transition-all"
            >
              Restart Engine
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
