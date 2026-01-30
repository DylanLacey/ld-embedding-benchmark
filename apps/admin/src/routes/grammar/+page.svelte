<script lang="ts">
import { goto } from "$app/navigation";

let { data } = $props();
// Writable derived: syncs from URL state, but allows local edits for typing
let search = $derived(data.search);

function handleSearch(e: Event) {
	e.preventDefault();
	const url = new URL(window.location.href);
	if (search) {
		url.searchParams.set("q", search);
	} else {
		url.searchParams.delete("q");
	}
	goto(url.toString());
}
</script>

<div class="flex justify-between items-center mb-6">
	<h1 class="text-3xl font-bold">Grammar Points</h1>
	<a href="/grammar/new" class="btn btn-primary">Add New</a>
</div>

<form onsubmit={handleSearch} class="mb-6">
	<div class="join">
		<input
			type="text"
			bind:value={search}
			placeholder="Search..."
			class="input input-bordered join-item"
		/>
		<button type="submit" class="btn join-item">Search</button>
	</div>
</form>

<div class="overflow-x-auto">
	<table class="table table-zebra">
		<thead>
			<tr>
				<th>Level</th>
				<th>Japanese</th>
				<th>Romaji</th>
				<th>Meaning</th>
				<th>Category</th>
				<th></th>
			</tr>
		</thead>
		<tbody>
			{#each data.points as point (point.id)}
				<tr class="hover">
					<td>
						{#if point.levelCode}
							<span class="badge badge-primary">{point.levelCode}</span>
						{/if}
					</td>
					<td class="font-bold">{point.japanese}</td>
					<td class="opacity-70">{point.romaji ?? ""}</td>
					<td>{point.meaning}</td>
					<td>{point.category ?? ""}</td>
					<td>
						<a href="/grammar/{point.id}" class="btn btn-xs btn-ghost">Edit</a>
					</td>
				</tr>
			{:else}
				<tr>
					<td colspan="6" class="text-center opacity-50">No grammar points found</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>
