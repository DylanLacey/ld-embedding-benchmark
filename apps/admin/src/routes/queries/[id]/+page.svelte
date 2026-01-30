<script lang="ts">
	let { data } = $props();
</script>

<div class="flex justify-between items-center mb-6">
	<h1 class="text-3xl font-bold">Edit Query</h1>
	<form method="POST" action="?/delete">
		<button
			type="submit"
			class="btn btn-error btn-outline"
			onclick={(e) => {
				if (!confirm('Delete this query?')) e.preventDefault();
			}}
		>
			Delete
		</button>
	</form>
</div>

<form method="POST" action="?/update" class="space-y-4 max-w-2xl">
	<div class="form-control">
		<label class="label" for="queryText"><span class="label-text">Query Text</span></label>
		<textarea id="queryText" name="queryText" required class="textarea textarea-bordered" rows="3"
			>{data.query.queryText}</textarea
		>
	</div>

	<div class="grid grid-cols-2 gap-4">
		<div class="form-control">
			<label class="label" for="queryLanguage"
				><span class="label-text">Query Language</span></label
			>
			<input
				type="text"
				id="queryLanguage"
				name="queryLanguage"
				value={data.query.queryLanguage ?? ''}
				class="input input-bordered"
			/>
		</div>
		<div class="form-control">
			<label class="label" for="targetLanguage"
				><span class="label-text">Target Language</span></label
			>
			<input
				type="text"
				id="targetLanguage"
				name="targetLanguage"
				value={data.query.targetLanguage ?? ''}
				class="input input-bordered"
			/>
		</div>
	</div>

	<div class="form-control">
		<label class="label" for="difficulty"><span class="label-text">Difficulty</span></label>
		<select id="difficulty" name="difficulty" class="select select-bordered">
			<option value="">-- Select --</option>
			<option value="direct" selected={data.query.difficulty === 'direct'}>Direct</option>
			<option value="descriptive" selected={data.query.difficulty === 'descriptive'}
				>Descriptive</option
			>
			<option value="situational" selected={data.query.difficulty === 'situational'}
				>Situational</option
			>
			<option value="adversarial" selected={data.query.difficulty === 'adversarial'}
				>Adversarial</option
			>
		</select>
	</div>

	<div class="form-control">
		<label class="label cursor-pointer justify-start gap-4">
			<input type="checkbox" name="isRanked" class="checkbox" checked={data.query.isRanked} />
			<span class="label-text">Ranked (graded relevance)</span>
		</label>
	</div>

	<button type="submit" class="btn btn-primary">Save Changes</button>
</form>

<h2 class="text-2xl font-bold mt-8 mb-4">Ground Truth ({data.expected.length})</h2>

{#if data.expected.length > 0}
	<div class="space-y-2">
		{#each data.expected as exp (exp.id)}
			<div class="card bg-base-200">
				<div class="card-body p-4 flex-row justify-between items-center">
					<div>
						<p class="font-bold">{exp.grammarPoint?.japanese ?? 'Unknown'}</p>
						<p class="opacity-70">{exp.grammarPoint?.meaning ?? ''}</p>
						{#if exp.relevanceScore}
							<span class="badge badge-sm">Relevance: {exp.relevanceScore}</span>
						{/if}
					</div>
					<form method="POST" action="?/removeExpected">
						<input type="hidden" name="expectedId" value={exp.id} />
						<button type="submit" class="btn btn-sm btn-ghost">Remove</button>
					</form>
				</div>
			</div>
		{/each}
	</div>
{:else}
	<p class="opacity-50">No ground truth defined</p>
{/if}

<a href="/queries/{data.query.id}/add-expected" class="btn btn-secondary mt-4">Add Ground Truth</a>
