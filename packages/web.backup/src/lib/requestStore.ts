/**
 * Store for tracking recent API requests for debugging purposes.
 * Keeps last 5 requests in memory.
 */

export interface RequestRecord {
  method: string;
  path: string;
  status: number;
  requestId: string | null;
  timestamp: Date;
}

class RequestStore {
  private records: RequestRecord[] = [];
  private maxRecords = 5;
  private listeners: Set<() => void> = new Set();

  add(record: RequestRecord) {
    this.records.unshift(record);
    if (this.records.length > this.maxRecords) {
      this.records.pop();
    }
    this.notifyListeners();
  }

  getRecords(): RequestRecord[] {
    return [...this.records];
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners() {
    this.listeners.forEach((listener) => listener());
  }

  clear() {
    this.records = [];
    this.notifyListeners();
  }
}

export const requestStore = new RequestStore();
