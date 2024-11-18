import React, { ErrorInfo } from 'react';
import RouterServices from '@features/router/services/router-service';

import '@styles/ui.less';

type PropsType = {
  children: React.ReactElement;
};
export default class ErrorBoundary extends React.Component<PropsType, { hasError: boolean }> {
  static lastError: Record<string, Record<string, Error | string>> | null = null;

  constructor(props: PropsType) {
    super(props);
    this.state = {
      hasError: false,
    };
  }

  static getDerivedStateFromError() {
    return {
      hasError: true,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    ErrorBoundary.lastError = {
      error: {
        name: error,
        info: "",
      },
    };
    RouterServices.replace(RouterServices.addRedirection(RouterServices.pathnames.ERROR));
  }

  render() {
    if (this.state.hasError) {
      return <div />;
    }
    return this.props.children;
  }
}
