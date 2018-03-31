export class Stack<T> {
    private _store: T[];

    constructor() {
        this._store = [];
    }
    push(val: T) {
      this._store.push(val);
    }
    pop(): T | undefined {
      return this._store.pop();
    }

    peek(): T | undefined {
        return this._store[this._store.length - 1];
    }

    clear(): void {
        this._store = [];
    }

    data(): Array<T> {
        return this._store;
    }
}
