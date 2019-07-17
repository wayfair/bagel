// TODO: Fix this nonsense

declare module 'byline' {
  declare function byline(readStream: ReadableStream, options: any): any;
  declare module.exports: typeof byline;
}
