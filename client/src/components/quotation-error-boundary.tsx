
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error?: Error;
  retryCount: number;
}

class QuotationErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, retryCount: 0 };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, retryCount: 0 };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('🚨 Quotation Error Boundary caught an error:', error);
    console.error('📍 Error Info:', errorInfo);
    
    // Try to save current state before crash
    try {
      const currentData = localStorage.getItem('draft-quotation');
      if (currentData) {
        localStorage.setItem('emergency-backup', currentData);
        console.log('💾 Emergency backup created');
      }
    } catch (backupError) {
      console.error('❌ Failed to create emergency backup:', backupError);
    }

    this.props.onError?.(error, errorInfo);
  }

  handleRetry = () => {
    if (this.state.retryCount < 3) {
      this.setState(prevState => ({
        hasError: false,
        error: undefined,
        retryCount: prevState.retryCount + 1
      }));
    } else {
      // Redirect to home after 3 retries
      window.location.href = '/';
    }
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="page-container">
          <Card className="max-w-lg mx-auto">
            <CardHeader>
              <CardTitle className="flex items-center text-destructive">
                <AlertTriangle className="h-5 w-5 mr-2" />
                Error en la Cotización
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                Ha ocurrido un error inesperado en la aplicación de cotización. 
                {this.state.retryCount > 0 && ` (Intento ${this.state.retryCount}/3)`}
              </p>
              
              {this.state.error && (
                <div className="bg-muted p-3 rounded text-sm">
                  <strong>Error:</strong> {this.state.error.message}
                </div>
              )}
              
              <div className="text-sm text-muted-foreground">
                💾 Tus datos han sido guardados automáticamente y pueden ser recuperados.
              </div>
              
              <div className="flex gap-2">
                {this.state.retryCount < 3 ? (
                  <Button onClick={this.handleRetry} className="flex-1">
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Reintentar
                  </Button>
                ) : (
                  <Button onClick={this.handleGoHome} className="flex-1">
                    <Home className="h-4 w-4 mr-2" />
                    Ir al Dashboard
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

export default QuotationErrorBoundary;
