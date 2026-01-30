<script lang="ts">
import "../app.css";
import favicon from "$lib/assets/favicon.svg";

const { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<div data-theme="synthwave" class="min-h-screen">
	{@render children()}
</div>
