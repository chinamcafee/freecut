export class StudioSaveQueue {
  private pending: Promise<void> = Promise.resolve()

  enqueue<T>(task: () => Promise<T>): Promise<T> {
    const run = this.pending.then(task, task)
    this.pending = run.then(
      () => undefined,
      () => undefined,
    )
    return run
  }
}
