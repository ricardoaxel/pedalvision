import {
	checkpoint,
	finishBatch,
	flagBatch,
	heartbeat,
	pauseBatch,
	resumeAll,
	resumeBatch,
	startBatch,
	stopAll,
	stopBatch,
	unflagBatch,
} from "./runner.ts";
import { isActive, listStates } from "./state.ts";
import { renderStatus, watchStatus } from "./status.ts";
import { supervise } from "./supervise.ts";

const USAGE = `catalog-runner — per-batch catalog control plane

Usage:
  catalog-runner start --batch <id> --kind pedals|boards --brand <name>
                       --total <n> [--worktree <dir>] [--assets-dir <dir>]
  catalog-runner checkpoint --batch <id> --item <id>
                       [--done <n>] [--images-accepted <n>]
                       [--images-rejected <n>] [--tokens <n>]
  catalog-runner finish --batch <id> [--assets-dir <dir>]
  catalog-runner pause <--batch <id> | --all>
  catalog-runner stop  <--batch <id> | --all> [--reason <text>]
  catalog-runner resume <--batch <id> | --all>
  catalog-runner status [--watch]
  catalog-runner heartbeat --batch <id>
  catalog-runner flag --batch <id> --reason <text>
  catalog-runner unflag --batch <id> --reason <text>
  catalog-runner supervise --batch <id> -- <command> [args...]
  --help

State/control/checkpoints/logs live under work/catalog (gitignored).
Checkpoint after every item. Stop is honoured at the next checkpoint; the
supervisor waits CATALOG_STOP_GRACE_MS, then adds SIGTERM/SIGKILL fallback.`;

type Args = {
	command: string;
	batch?: string;
	kind?: "pedals" | "boards";
	brand?: string;
	total?: number;
	worktree: string;
	assetsDir?: string;
	item?: string;
	done?: number;
	imagesAccepted?: number;
	imagesRejected?: number;
	tokens?: number;
	all: boolean;
	watch: boolean;
	reason: string;
	commandArgs: string[];
	help: boolean;
};

function readNumber(argv: string[], index: number, flag: string): number {
	const raw = argv[index + 1];
	const value = Number(raw);
	if (!Number.isFinite(value) || value < 0) {
		throw new Error(`${flag} must be a non-negative number (got "${raw}")`);
	}
	return value;
}

function parseArgs(argv: string[]): Args {
	const args: Args = {
		command: argv[0] ?? "",
		worktree: process.cwd(),
		all: false,
		watch: false,
		reason: "",
		commandArgs: [],
		help: false,
	};
	let i = 1;
	for (; i < argv.length; i++) {
		const arg = argv[i];
		if (arg === "--") {
			args.commandArgs = argv.slice(i + 1);
			break;
		}
		switch (arg) {
			case "--batch":
				args.batch = argv[++i];
				break;
			case "--kind": {
				const value = argv[++i];
				if (value !== "pedals" && value !== "boards") {
					throw new Error(`--kind must be pedals|boards (got "${value}")`);
				}
				args.kind = value;
				break;
			}
			case "--brand":
				args.brand = argv[++i];
				break;
			case "--total":
				args.total = readNumber(argv, i, arg);
				i++;
				break;
			case "--worktree":
				args.worktree = argv[++i];
				break;
			case "--assets-dir":
				args.assetsDir = argv[++i];
				break;
			case "--item":
				args.item = argv[++i];
				break;
			case "--done":
				args.done = readNumber(argv, i, arg);
				i++;
				break;
			case "--images-accepted":
				args.imagesAccepted = readNumber(argv, i, arg);
				i++;
				break;
			case "--images-rejected":
				args.imagesRejected = readNumber(argv, i, arg);
				i++;
				break;
			case "--tokens":
				args.tokens = readNumber(argv, i, arg);
				i++;
				break;
			case "--all":
				args.all = true;
				break;
			case "--watch":
				args.watch = true;
				break;
			case "--reason":
				args.reason = argv[++i] ?? "";
				break;
			case "--help":
			case "-h":
				args.help = true;
				break;
			default:
				throw new Error(`unknown argument "${arg}"`);
		}
	}
	return args;
}

function requireBatch(args: Args): string {
	if (!args.batch) throw new Error("--batch <id> is required");
	return args.batch;
}

async function main(): Promise<void> {
	const args = parseArgs(process.argv.slice(2));
	if (args.help || !args.command) {
		console.log(USAGE);
		if (!args.command) process.exitCode = 1;
		return;
	}
	const root = process.cwd();

	switch (args.command) {
		case "start": {
			if (
				!args.batch ||
				!args.kind ||
				!args.brand ||
				args.total === undefined
			) {
				throw new Error("start requires --batch, --kind, --brand and --total");
			}
			const state = await startBatch({
				root,
				batchId: args.batch,
				kind: args.kind,
				brand: args.brand,
				total: args.total,
				worktree: args.worktree,
				assetsDir: args.assetsDir,
			});
			console.log(
				`started ${state.batchId}: ${state.kind} / ${state.brand} · 0/${state.total}`,
			);
			return;
		}
		case "checkpoint": {
			if (!args.item) throw new Error("checkpoint requires --item");
			const result = await checkpoint({
				root,
				batchId: requireBatch(args),
				itemId: args.item,
				done: args.done,
				imagesAccepted: args.imagesAccepted,
				imagesRejected: args.imagesRejected,
				tokens: args.tokens,
			});
			console.log(
				`checkpoint ${result.state.batchId}: ${result.state.done}/${result.state.total} · ${result.state.status}`,
			);
			process.exitCode = result.exitCode;
			return;
		}
		case "finish": {
			const result = await finishBatch(
				root,
				requireBatch(args),
				args.assetsDir,
			);
			console.log(
				`finish ${result.state.batchId}: ${result.state.status} · ${result.state.done}/${result.state.total}`,
			);
			process.exitCode = result.exitCode;
			return;
		}
		case "pause": {
			if (args.all) {
				for (const state of await listStates(root)) {
					if (isActive(state)) await pauseBatch(root, state.batchId);
				}
			} else {
				await pauseBatch(root, requireBatch(args));
			}
			console.log("paused");
			return;
		}
		case "stop": {
			if (args.all) {
				await stopAll(root, args.reason || "global STOP");
			} else {
				await stopBatch(root, requireBatch(args));
			}
			console.log("stopped");
			return;
		}
		case "resume": {
			if (args.all) {
				await resumeAll(root);
			} else {
				await resumeBatch(root, requireBatch(args));
			}
			console.log("resumed");
			return;
		}
		case "status":
			if (args.watch) await watchStatus(root);
			else console.log(await renderStatus(root));
			return;
		case "heartbeat": {
			const state = await heartbeat(root, requireBatch(args));
			console.log(`heartbeat ${state.batchId}`);
			return;
		}
		case "flag": {
			if (!args.reason) throw new Error("flag requires --reason");
			await flagBatch(root, requireBatch(args), args.reason);
			console.log("flagged");
			return;
		}
		case "unflag": {
			if (!args.reason) throw new Error("unflag requires --reason");
			await unflagBatch(root, requireBatch(args), args.reason);
			console.log("unflagged");
			return;
		}
		case "supervise": {
			if (args.commandArgs.length === 0) {
				throw new Error("supervise requires -- <command> [args...]");
			}
			const [command, ...rest] = args.commandArgs;
			process.exitCode = await supervise({
				root,
				batchId: requireBatch(args),
				command: command as string,
				args: rest,
			});
			return;
		}
		default:
			throw new Error(`unknown command "${args.command}"`);
	}
}

main().catch((error: unknown) => {
	console.error(`error: ${error instanceof Error ? error.message : error}`);
	process.exitCode = 1;
});
