# M010 S01 - Fleet read model and `/fleet` contract

Realigned from the earlier attention-density slice. The prior `S01-SUMMARY.md` is preserved as groundwork reference only.

## Parallel lane constraints

- This slice is first in execution order for M010.
- Do not edit runtime ownership code in this slice lane (`packages/runtime-core/**`, `packages/runtime-local/**`, `services/runtime-service/**`).
- If `GET /fleet` needs unavailable runtime fields, log them in [`../DEPENDENCY-GAPS.md`](../DEPENDENCY-GAPS.md) and bridge at M010 read-model boundary.

## Tasks

- [ ] Define `GET /fleet` as the single homepage endpoint returning `generatedAt`, `totals`, `sessions[]`, `recentEvents[]`, and `heatmap[]`.
- [ ] Decide the minimum derived fields each fleet session item must carry: status, activity, attention rank, repo, runtime, heartbeat freshness, blocked reason, recommended action, and branch/worktree metadata when present.
- [ ] Build the aggregated read model from existing runtime tables, Andon status logic, and Holistic grounding where needed.
- [ ] Add automated coverage for payload shape and ranking order.

## Success Criteria

- The homepage no longer depends on many separate fetches to assemble mission-control state.
