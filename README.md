# Twin Cliffs

The front door at [twincliffs.com](https://twincliffs.com): a digital lab for tinkering,
experimentation, and sharing.

One static page. Conway's Game of Life runs in the background of the hero, and the featured
project's card has an ASCII river with salmon jumping out of it. Plain HTML, Tailwind, and two
small Stimulus controllers, served by nginx and deployed with [Kamal](https://kamal-deploy.org).

```bash
# preview locally at http://localhost:8080
docker build --platform linux/amd64 -t twincliffs . && docker run --rm -p 8080:80 twincliffs

# deploy (commit first)
bin/kamal deploy
```

Fonts: [Geist and Geist Mono](https://vercel.com/font) by Vercel, under the SIL Open Font License
(`site/fonts/OFL.txt`).
