declare module "ppt-to-text" {
  const pptToText: {
    extractText: (input: Buffer | string) => string;
  };
  export default pptToText;
}
