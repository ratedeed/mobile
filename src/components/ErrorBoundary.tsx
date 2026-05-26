import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, Platform } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import * as Sentry from '@sentry/react-native';
import Typography from './common/Typography';
import Button from './common/Button';
import { Spacing, Colors, Radii } from '../constants/designTokens';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    Sentry.captureException(error, { extra: { errorInfo } });
    this.setState({
      error,
      errorInfo,
    });
  }

  handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
    this.props.onReset?.();
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <View style={styles.container}>
          <View style={styles.content}>
            <View style={styles.iconContainer}>
              <FontAwesome5 name="exclamation-triangle" size={48} color={Colors.warning} />
            </View>
            
            <Typography variant="h4" style={styles.title}>
              Something went wrong
            </Typography>
            
            <Typography variant="body" style={styles.message}>
              We're sorry for the inconvenience. Please try again.
            </Typography>
            
            {__DEV__ && this.state.error && (
              <View style={styles.errorDetails}>
                <Text style={styles.errorText}>
                  {this.state.error.toString()}
                </Text>
                {this.state.errorInfo && this.state.errorInfo.componentStack && (
                  <Text style={styles.errorText}>
                    {this.state.errorInfo.componentStack.toString()}
                  </Text>
                )}
              </View>
            )}
            
            <View style={styles.buttonContainer}>
              <Button
                title="Try Again"
                onPress={this.handleReset}
                style={styles.button}
              />
            </View>
          </View>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.neutral50,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  content: {
    alignItems: 'center',
    maxWidth: 400,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.warning + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  title: {
    color: Colors.neutral900,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  message: {
    color: Colors.neutral600,
    textAlign: 'center',
    marginBottom: Spacing.xl,
  },
  errorDetails: {
    backgroundColor: Colors.neutral100,
    padding: Spacing.md,
    borderRadius: Radii.md,
    marginBottom: Spacing.lg,
    width: '100%',
  },
  errorText: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 11,
    color: Colors.error,
    marginBottom: Spacing.xs,
  },
  buttonContainer: {
    width: '100%',
  },
  button: {
    minWidth: 150,
  },
});

export default ErrorBoundary;
