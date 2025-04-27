// biome-ignore lint/complexity/noStaticOnlyClass: <explanation>
export class Logger {
  static info(message: string): void {
    console.log(message);
  }

  static summary(lines: string[]): void {
    for (const line of lines) {
      console.log(line);
    }
  }
}
