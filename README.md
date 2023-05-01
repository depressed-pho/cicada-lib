# cicada-lib

This is a set of ECMAScript / TypeScript modules that makes the life of
Minecraft Bedrock addon creators better. Modules include:

<dl>
    <dt><code>cicada-lib/shims/console.js</code></dt>
    <dd>
        The scripting API doesn't provide a proper <a href="https://developer.mozilla.org/en-US/docs/Web/API/console">console</a> object. Its <code>debug()</code>, <code>info()</code> and <code>log()</code> are non-working. It doesn't support <a href="https://developer.mozilla.org/en-US/docs/Web/API/console#outputting_text_to_the_console">pretty-printing or string substitutions</a>. Importing <code>cicada-lib/shims/console.js</code> replaces the global <code>console</code> object that supports basically everything. It can even pretty-print ECMAScript objects with Minecraft formatting / colour codes.
    </dd>
    <dt><code>cicada-lib/thread.js</code></dt>
    <dd>
        This is a cooperative thread based on <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/async_function*">async generator functions</a>. That is, threads continue running until they <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/await">await</a> or <a href="https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/yield">yield</a>, and suspended threads will be automatically resumed on the next game tick.
    </dd>
    <dt><code>cicada-lib/player.js</code></dt>
    <dd>
        An improved <a href="https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/player">Player</a> class. As a notable extension it supports per-player preferences based on <a href="https://developers.google.com/protocol-buffers">Protocol Buffers</a>. You write a <code>.proto</code> file that describes your preferences object, and the library automatically serialises and saves it in a <a href="https://learn.microsoft.com/en-us/minecraft/creator/scriptapi/minecraft/server/dynamicpropertiesdefinition">dynamic property</a>. Note that you still need to create a UI for the preferences.
    </dd>
</dl>

...and many more.

## How to use

```shell
% npm init
...
% npm -i -S github:depressed-pho/cicada-lib
```

FIXME: documentation forthcoming

## Release notes

See [NEWS](NEWS.md).

## Why cicada?

Do you know [cicadas](https://en.wikipedia.org/wiki/Cicada) spend their
lives as nymphs underground for like 10 years, and once they emerge they
die only after a few weeks or so? The experimental [scripting
engine](https://bedrock.dev/docs/1.12.0.0/1.12.0.2/Scripting#Scripting%20System)
was just like that. When it was introduced back in 2018 it looked really
promising, but its development slowed down and finally ceased to exist. We
hope the new scripting API won't die soon. We hope it will evolve to the
extent that we can develop decent mods for Minecraft Bedrock just like we
can do for Java Edition. We want to build insanely complicated factories
like we do on JE with GregTech. We want to manage our storages and
autocraft our items like we do on JE with Applied Energistics 2, or Refined
Storage. We want to extend our vanilla gameplay with magical flowers like
we do on JE with Botania. We want to refine our ores with acidic liquids
and toxic gases like we do on JE with Mekanism. The name "cicada" is like
memento mori.

## Author

PHO

## License

[CC0](https://creativecommons.org/share-your-work/public-domain/cc0/)
“No Rights Reserved”
