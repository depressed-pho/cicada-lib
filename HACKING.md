# Branches

Starting from v12.0.0, cicada-lib is released in two flavours: "stable" and
"beta". The stable branch which resides as `stable` branch in the
repository is now released with odd major version numbers, while the beta
branch `master` is released with even ones.

The `stable` branch is for the stable scripting API of Minecraft
Bedrock. The `master` branch is for the beta API found in stable releases
as opposed to preview/beta releases.

If you want to use the stable branch, you need to declare a dependency with
a branch name:

```
"dependencies": {
  "cicada-lib": "github:depressed-pho/cicada-lib#stable"
}
```

## Branching policy

Any changes, except for accommodating the `stable` branch to the latest
stable API, should be first committed to the `master` (i.e. the beta)
branch. It should be merged to the `stable` branch afterwards.

No commits in the `stable` branch should be merged back to `master`.
