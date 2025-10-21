import * as fs from "fs";
import * as path from "path";

export interface OpinionLog {
  session_id: string;
  timestamp: string;
  text: string;
}

/**
 * CSV Logger for opinion/voice input logs
 * Implements RFC 4180 compliant CSV formatting
 */
export class CsvLogger {
  private filePath: string;
  private headers = ["session_id", "timestamp", "text"];

  constructor(fileName = "opinions.csv") {
    this.filePath = path.resolve(process.cwd(), fileName);
    this.initialize();
  }

  /**
   * Initialize CSV file with headers if it doesn't exist
   */
  private initialize(): void {
    if (!fs.existsSync(this.filePath)) {
      const headerRow = this.headers.join(",") + "\n";
      fs.writeFileSync(this.filePath, headerRow, "utf-8");
      console.log(`[CsvLogger] Initialized new CSV file: ${this.filePath}`);
    } else {
      console.log(`[CsvLogger] Using existing CSV file: ${this.filePath}`);
    }
  }

  /**
   * Escape field according to RFC 4180
   * - Fields containing comma, double-quote, or newline must be quoted
   * - Double-quotes inside fields must be escaped as ""
   */
  private escapeField(field: string): string {
    if (
      field.includes(",") ||
      field.includes('"') ||
      field.includes("\n") ||
      field.includes("\r")
    ) {
      return `"${field.replace(/"/g, '""')}"`;
    }
    return field;
  }

  /**
   * Append a log entry to the CSV file
   */
  async append(data: OpinionLog): Promise<void> {
    const row = [
      this.escapeField(data.session_id),
      this.escapeField(data.timestamp),
      this.escapeField(data.text),
    ].join(",") + "\n";

    await fs.promises.appendFile(this.filePath, row, "utf-8");
  }

  /**
   * Get the file path
   */
  getFilePath(): string {
    return this.filePath;
  }
}

// Singleton instance
export const csvLogger = new CsvLogger();
