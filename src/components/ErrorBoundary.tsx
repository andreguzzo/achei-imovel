import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

interface Props { children: ReactNode }
interface State { hasError: boolean }

class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Unhandled UI error:", error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="container flex flex-col items-center justify-center gap-4 py-24 text-center">
        <AlertTriangle className="h-10 w-10 text-destructive" />
        <h1 className="font-display text-2xl font-bold text-foreground">
          Algo deu errado nesta página
        </h1>
        <p className="max-w-md text-sm text-muted-foreground">
          Tivemos um problema inesperado ao carregar o conteúdo. Você pode tentar novamente ou
          voltar para a página inicial.
        </p>
        <div className="flex gap-2">
          <Button onClick={() => window.location.reload()}>Tentar novamente</Button>
          <Button variant="outline" onClick={() => { window.location.href = "/"; }}>
            Ir para o início
          </Button>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
