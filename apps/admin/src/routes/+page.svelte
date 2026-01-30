<script lang="ts">
	let { data } = $props();
</script>

<h1 class="text-3xl font-bold mb-8">Dashboard</h1>

<div class="stats shadow">
	<div class="stat">
		<div class="stat-title">Grammar Points</div>
		<div class="stat-value text-primary">{data.stats.grammarPoints}</div>
	</div>

	<div class="stat">
		<div class="stat-title">Benchmark Queries</div>
		<div class="stat-value text-secondary">{data.stats.queries}</div>
	</div>
</div>

{#if data.stats.byLevel.length > 0}
	<h2 class="text-2xl font-bold mt-8 mb-4">By Level</h2>
	<div class="overflow-x-auto">
		<table class="table">
			<thead>
				<tr>
					<th>Level</th>
					<th>Count</th>
				</tr>
			</thead>
			<tbody>
				{#each data.stats.byLevel as row (row.levelId)}
					<tr>
						<td>{row.levelId ?? 'Unassigned'}</td>
						<td>{row.count}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{/if}
