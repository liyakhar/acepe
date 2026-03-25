<div class="flex flex-col">
	{#each Array(8) as _}
		<div class="flex items-center gap-2 h-9 px-3 border-b border-border/15 animate-pulse">
			<div class="h-2 w-2 rounded-full bg-accent/30"></div>
			<div class="h-2.5 w-8 rounded bg-accent/25"></div>
			<div class="h-2.5 flex-1 max-w-[60%] rounded bg-accent/20"></div>
			<div class="ml-auto h-2 w-6 rounded bg-accent/15"></div>
		</div>
	{/each}
</div>
