import React from 'react';
import { AlertTriangle } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('A.M.I. UI error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 rounded-xl border border-red-200 bg-red-50 text-red-800 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5" />
          <span>{this.props.fallback || 'This section had trouble loading.'}</span>
        </div>
      );
    }

    return this.props.children;
  }
}
