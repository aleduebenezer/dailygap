import { Component, ReactNode, ErrorInfo } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";

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
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught application error:", error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = "/";
  };

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen w-full flex items-center justify-center p-4 bg-background text-foreground">
          <div className="max-w-md w-full p-6 sm:p-8 rounded-2xl bg-card border border-border shadow-xl text-center space-y-5">
            <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center">
              <AlertTriangle className="w-6 h-6" />
            </div>
            
            <div className="space-y-2">
              <h2 className="text-xl font-bold font-display">Something went wrong</h2>
              <p className="text-sm text-muted-foreground">
                An unexpected error occurred while loading this view. You can reload the page or return to the home screen.
              </p>
            </div>

            {this.state.error?.message && (
              <div className="p-3 bg-muted/60 rounded-xl text-xs font-mono text-left text-muted-foreground overflow-auto max-h-28 border border-border/50">
                {this.state.error.message}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
              <Button
                variant="outline"
                className="flex-1 rounded-xl gap-2"
                onClick={this.handleReload}
              >
                <RefreshCw className="w-4 h-4" />
                Reload Page
              </Button>
              <Button
                variant="default"
                className="flex-1 rounded-xl gap-2"
                onClick={this.handleReset}
              >
                <Home className="w-4 h-4" />
                Go to Home
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
export default ErrorBoundary;
