# Taro

> Autonomous multi-party workflow coordination, built on the
> [TrueForge](https://github.com/truefoundry/trueforge) agent harness.
>
> Built for the [Agent Harness Hackathon](https://www.wemakedevs.org/hackathons/trueforge)
> by WeMakeDevs × TrueFoundry (Aug 24–30, 2026).

Real-world jobs sometimes fail on coordination, not work. A residential roofing repair
involves a homeowner, a project manager, a crew, and a supplier — and today a
human coordinates all of them manually, over calls and texts, for days.

Taro replaces that coordinator. Define **any** multi-party job at runtime —
the parties, the steps, the dependencies, the rules — and an AI agent drives
every party toward completion in parallel: messaging them, propagating each
party's decisions to everyone affected, resolving conflicts with
runtime-generated code, and pausing for human approval before anything
binding.

Nothing in the engine is domain-specific. The roofing job is one demo preset —
swap it and Taro coordinates a wedding, a product launch, or an office move.

## How it works

- **TrueForge owns cognition** — one orchestrator agent per job: planning,
  per-party message composition via parallel subagents, conflict resolution,
  sandboxed code execution.
- **The Taro server owns events and state** — it translates world events
  (a party's message, an approval click) into agent turns, and serves the MCP
  tools the agent uses to read and write job state.
- **The human owns irreversible decisions** — every binding commitment goes
  through a native TrueForge approval gate.

## Status

🚧 Under active development during the hackathon. Setup instructions, demo
video, and full documentation will land here as the build progresses.

## Setup

_Coming soon._

## Qodo Code Review Evidence

_To be completed at submission._

## License

[MIT](LICENSE)
