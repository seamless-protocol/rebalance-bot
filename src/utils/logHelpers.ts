export const logWithPrefix = (prefix: string, message: string, data?: any) => {
  if (data) {
    console.log(`[${prefix}] ${message}:`, data);
  } else {
    console.log(`[${prefix}] ${message}`);
  }
};

export const logWarningWithPrefix = (prefix: string, message: string) => {
  console.warn(`[${prefix}] ${message}`);
};
