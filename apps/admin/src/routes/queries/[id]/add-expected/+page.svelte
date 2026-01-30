<script lang="ts">
import { goto } from "$app/navigation";
import { page } from "$app/stores";

let { data } = $props();
let searchOverride = $state<string | undefined>(undefined);
let search = $derived(searchOverride ?? data.search);
let selectedPoint = $state<(typeof data.points)[0] | null>(null);
let relevanceScore = $state<number | null>(null);

function handleSearch(e: Event) {
	e.preventDefault();
	const url = new URL($page.url);
	if (search) {
		url.searchParams.set("q", search);
	} else {
		url.searchParams.delete("q");
	}
	// Reset override so we pick up data.search after navigation
	searchOverride = undefined;
	goto(url.toString(), { replaceState: true });
}

function selectPoint(point: (typeof data.points)[0]) {
	selectedPoint = point;
}
</script>

<h1 class="text-3xl font-bold mb-2">Add Ground Truth</h1>
<p class="opacity-70 mb-6">Query: {data.query.queryText}</p>

<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
	<div>
		<form onsubmit={handleSearch} class="mb-4">
			<div class="join">
				<input
					type="text"
					bind:value={searchOverride}
					placeholder="Search grammar points..."
					class="input input-bordered join-item w-full"
				/>
				<button type="submit" class="btn join-item">Search</button>
			</div>
		</form>

		<div class="space-y-2 max-h-96 overflow-y-auto">
			{#each data.points as point (point.id)}
				<button
					type="button"
					class="card bg-base-200 w-full text-left hover:bg-base-300 transition-colors"
					class:ring-2={selectedPoint?.id === point.id}
					class:ring-primary={selectedPoint?.id === point.id}
					onclick={() => selectPoint(point)}
				>
					<div class="card-body p-3">
						<div class="flex justify-between items-start">
							<div>
								<p class="font-bold">{point.japanese}</p>
								<p class="text-sm opacity-70">{point.romaji}</p>
								<p class="text-sm">{point.meaning}</p>
							</div>
							{#if point.levelCode}
								<span class="badge badge-primary badge-sm">{point.levelCode}</span>
							{/if}
						</div>
					</div>
				</button>
			{:else}
				<p class="opacity-50 text-center py-4">No grammar points found</p>
			{/each}
		</div>
	</div>

	<div>
		{#if selectedPoint}
			<div class="card bg-base-300">
				<div class="card-body">
					<h2 class="card-title">{selectedPoint.japanese}</h2>
					<p class="opacity-70">{selectedPoint.romaji}</p>
					<p>{selectedPoint.meaning}</p>

					<form method="POST" action="?/add" class="mt-4 space-y-4">
						<input type="hidden" name="grammarPointId" value={selectedPoint.id} />

						{#if data.query.isRanked}
							<fieldset class="form-control">
								<legend class="label"><span class="label-text">Relevance Score</span></legend>
								<div class="flex gap-4">
									{#each [1, 2, 3] as score (score)}
										<label class="label cursor-pointer gap-2">
											<input
												type="radio"
												name="relevanceScore"
												value={score}
												class="radio radio-primary"
												bind:group={relevanceScore}
											/>
											<span>{score}</span>
										</label>
									{/each}
								</div>
							</fieldset>
						{/if}

						<div class="card-actions">
							<button type="submit" class="btn btn-primary">Add to Ground Truth</button>
							<a href="/queries/{data.query.id}" class="btn btn-ghost">Cancel</a>
						</div>
					</form>
				</div>
			</div>
		{:else}
			<div class="card bg-base-200">
				<div class="card-body text-center opacity-50">Select a grammar point from the list</div>
			</div>
		{/if}
	</div>
</div>
