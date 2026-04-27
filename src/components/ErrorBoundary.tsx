import { Component, ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}
interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: unknown) {
    // eslint-disable-next-line no-console
    console.error("[ErrorBoundary]", error, info);
  }

  reset = () => this.setState({ hasError: false, error: undefined });

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="flex min-h-[300px] flex-col items-center justify-center gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-center">
          <AlertTriangle className="h-8 w-8 text-destructive" />
          <div>
            <p className="font-semibold">Algo deu errado ao renderizar esta seção.</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {this.state.error?.message ?? "Erro desconhecido"}
            </p>
          </div>
          <button
            onClick={this.reset}
            className="rounded-md border border-border bg-background px-4 py-2 text-sm hover:bg-muted"
          >
            Tentar novamente
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
