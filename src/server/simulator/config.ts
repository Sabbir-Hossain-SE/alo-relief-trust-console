export type SimulatorConfig = {
  /** Documents that can be processing at once. */
  concurrency: number;
  /** How long one document occupies a worker. */
  serviceTimeMs: number;
  /** Share of first attempts that fail outright. */
  failureRate: number;
  /** Share of first attempts that extract something an operator must check. */
  reviewRate: number;
  /**
   * How much each retry improves the odds. The failures worth retrying are
   * transient by definition, so a second attempt should usually clear.
   */
  retryImprovement: number;
  /** Share of individual file uploads that fail transiently. */
  uploadFailureRate: number;
};

export const DEFAULT_SIMULATOR_CONFIG: SimulatorConfig = {
  concurrency: 8,
  serviceTimeMs: 220,
  failureRate: 0.07,
  reviewRate: 0.09,
  retryImprovement: 0.25,
  uploadFailureRate: 0.06,
};
