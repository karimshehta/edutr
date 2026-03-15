import React, { createContext, useContext, useState, ReactNode } from 'react';
import { Toast } from '../components/Toast';

type ToastType = 'success' | 'error' | 'info';

interface ToastContextType {
  showToast: (message: string, type?: ToastType, duration?: number) => void;
}

const ToastContext = createContext<ToastContextType>({
  showToast: () => {},
});

export const useToast = () => useContext(ToastContext);

interface ToastProviderProps {
  children: ReactNode;
}

export function ToastProvider({ children }: ToastProviderProps) {
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<ToastType>('success');
  const [toastDuration, setToastDuration] = useState(2000);

  const showToast = (message: string, type: ToastType = 'success', duration: number = 2000) => {
    setToastMessage(message);
    setToastType(type);
    setToastDuration(duration);
    setToastVisible(true);
  };

  const hideToast = () => {
    setToastVisible(false);
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <Toast
        message={toastMessage}
        type={toastType}
        visible={toastVisible}
        onHide={hideToast}
        duration={toastDuration}
      />
    </ToastContext.Provider>
  );
}
