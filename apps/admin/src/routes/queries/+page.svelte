<script lang="ts">
let { data } = $props();
</script>

<div class="flex justify-between items-center mb-6">
	<h1 class="text-3xl font-bold">Benchmark Queries</h1>
	<a href="/queries/new" class="btn btn-primary">Add New</a>
</div>

<div class="overflow-x-auto">
	<table class="table table-zebra">
		<thead>
			<tr>
				<th>Query</th>
				<th>Difficulty</th>
				<th>Language</th>
				<th>Expected</th>
				<th></th>
			</tr>
		</thead>
		<tbody>
			{#each data.queries as query (query.id)}
				<tr class="hover">
					<td class="max-w-md truncate">{query.queryText}</td>
					<td>
						{#if query.difficulty}
							<span class="badge badge-secondary">{query.difficulty}</span>
						{/if}
					</td>
					<td>{query.queryLanguage ?? ""}</td>
					<td>
						<span class="badge badge-outline">{query.expectedCount}</span>
					</td>
					<td>
						<a href="/queries/{query.id}" class="btn btn-xs btn-ghost">Edit</a>
					</td>
				</tr>
			{:else}
				<tr>
					<td colspan="5" class="text-center opacity-50">No queries found</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>
