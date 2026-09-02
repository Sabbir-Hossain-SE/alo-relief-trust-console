import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Next regenerates AGENTS.md and CLAUDE.md on every dev start; this repo does
  // not carry them.
  agentRules: false,
};

export default nextConfig;
