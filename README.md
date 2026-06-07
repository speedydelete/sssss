

# sssss

Smallest Spaceships Supporting Specific Speeds

The smallest known spaceships of various speeds in certain classes of [cellular automata](https://conwaylife.com/wiki/Cellular_automata). The website is at https://speedydelete.com/5s/, and has more information.

Installation:

```bash
git clone https://github.com/speedydelete/lifeweb
cd lifeweb
./install
cd ..
npx tsc
```

## "5s" Command Documentation

```

Usage: ./5s <subcommand> [args]

The "type" argument is the rulespace, can be int, intb0, ot, otb0, intgen, otgen, intb1e, intnos, or int1dt.

Subcommands:

    ./5s get <speed> [adjustables] - Get the speed in the database, adjustables can be "yes", "no", or "only".

    ./5s add <type> <file> - Add the given file (in 5S format) to the given type's database.
    ./5s add_no_verify <type> <file> - Like add, but does not verify the ships are correct.

    ./5s add_rle <type> <file> - Add the given file (as a RLE) to the given type's database.
    ./5s add_rle_no_verify <type> <file> - Like add_rle, but does not verify the ships are correct.

    ./5s randomsearch - Run the randomsearch program, explained more below.


The randomsearch program is a successor to matchpatt, it finds new speeds by running patterns in random rules. It supports INT, INT B0, and INT Generations.

Usage: ./5s randomsearch <type> <minrule> <maxrule> <rle> <generations> [extra-args]

The "type" argument can be "none" to disable record adding from the database, or "report-all" to not use record checking at all.

Extra arguments:

    initial-gens=number - Run the pattern for that many generations before searching.

    max-bb=heightxwidth - Patterns cannot exceed the given bounding box.

    max-pop=number - Patterns cannot exceed the given population.

    no-bb-change - The bounding box of the pattern cannot change size while running.

    check-linear=gens - Check for linear growth after that many generations.

    no-force-ships - Disable forcing of rules to have spaceships.

```
