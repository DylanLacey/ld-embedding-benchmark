<script lang="ts">
import GrammarForm from "$lib/components/grammar/GrammarForm.svelte";

let { data } = $props();
</script>

<div class="flex justify-between items-center mb-6">
	<h1 class="text-3xl font-bold">Edit: {data.point.japanese}</h1>
	<form method="POST" action="?/delete">
		<button
			type="submit"
			class="btn btn-error btn-outline"
			onclick={(e) => {
				if (!confirm('Delete this grammar point?')) e.preventDefault();
			}}
		>
			Delete
		</button>
	</form>
</div>

<GrammarForm point={data.point} levels={data.levels} action="?/update" />

<h2 class="text-2xl font-bold mt-8 mb-4">Examples ({data.examples.length})</h2>

{#if data.examples.length > 0}
	<div class="space-y-2">
		{#each data.examples as example (example.id)}
			<div class="card bg-base-200">
				<div class="card-body p-4">
					<p class="font-bold">{example.japanese}</p>
					<p class="opacity-70">{example.english ?? ''}</p>
				</div>
			</div>
		{/each}
	</div>
{:else}
	<p class="opacity-50">No examples yet</p>
{/if}
