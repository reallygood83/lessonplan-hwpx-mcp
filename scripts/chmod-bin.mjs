#!/usr/bin/env node
import { chmodSync } from "node:fs";
try { chmodSync("dist/index.js", 0o755); } catch {}
