> Our organizational level renovate configs

When we onboard a new repository with `renovate` it will use the default config
(`default.json`) that essentially ships some sane defaults from `main.json`.

By default, once the repo has been onboarded, the renovate config looks like
this:

```js
{
  "extends": ["github>freecodecamp/renovate-config"]
}
```

If you would like to override the defaults, then use something like the below:

1. To use weekend runs, add the `schedule-weekend` key:

   ```js
   {
    "extends": [
      "github>freecodecamp/renovate-config:schedule-weekend",
      ...
      ],
    ...
   }
   ```

2. To use the hacktoberfest schedule:

   ```js
   {
    "extends": [
      "github>freecodecamp/renovate-config:schedule-hacktoberfest",
      ...
      ],
    ...
   }
   ```

3. OR start from scratch:

   ```js
   {
   "extends": [
     "config:recommended",
     ...
     ],
   ...
   }
   ```
