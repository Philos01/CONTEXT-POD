import { ref } from 'vue';

interface AlertOptions {
  message: string;
  title?: string;
  type?: 'info' | 'success' | 'warning' | 'error' | 'confirm';
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void;
}

class AlertService {
  private isVisible = ref(false);
  private alertOptions = ref<AlertOptions>({ message: '' });
  private resolve: (value: boolean) => void = () => {};

  show(options: AlertOptions): Promise<boolean> {
    return new Promise((resolve) => {
      this.resolve = resolve;
      this.alertOptions.value = options;
      this.isVisible.value = true;
    });
  }

  info(message: string, options?: Partial<AlertOptions>) {
    return this.show({
      message,
      type: 'info',
      ...options
    });
  }

  success(message: string, options?: Partial<AlertOptions>) {
    return this.show({
      message,
      type: 'success',
      ...options
    });
  }

  warning(message: string, options?: Partial<AlertOptions>) {
    return this.show({
      message,
      type: 'warning',
      ...options
    });
  }

  error(message: string, options?: Partial<AlertOptions>) {
    return this.show({
      message,
      type: 'error',
      ...options
    });
  }

  showConfirm(message: string, options?: Partial<AlertOptions>) {
    return this.show({
      message,
      type: 'confirm',
      confirmText: options?.confirmText || '确定',
      cancelText: options?.cancelText || '取消',
      ...options
    });
  }

  close() {
    this.isVisible.value = false;
    this.resolve(false);
  }

  confirm() {
    this.isVisible.value = false;
    this.alertOptions.value.onConfirm?.();
    this.resolve(true);
  }

  get isVisibleRef() {
    return this.isVisible;
  }

  get options() {
    return this.alertOptions.value;
  }
}

export const alertService = new AlertService();
export function useAlert() {
  return alertService;
}