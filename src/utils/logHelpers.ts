export const logWithPrefix = (eventName: string, message: string, data?: any) => {
  const prefix = `[${eventName}]`;
  if (data) {
    console.log(`${prefix} ${message}:`, data);
  } else {
    console.log(`${prefix} ${message}`);
  }
};
