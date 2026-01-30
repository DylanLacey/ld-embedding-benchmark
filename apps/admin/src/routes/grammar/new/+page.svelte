<script lang="ts">
	import GrammarForm from "$lib/components/grammar/GrammarForm.svelte";

	let { data } = $props();
</script>

<h1 class="text-3xl font-bold mb-6">New Grammar Point</h1>

<GrammarForm levels={data.levels} action="" />
