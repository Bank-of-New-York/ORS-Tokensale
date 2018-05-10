#!/usr/bin/env python3

import csv

FILENAME = "RCSnapshot_04MAY2018.csv"
CHUNKSIZE = 100

def quanta(number):
    parts = number.split(",")
    decimals = 18
    return int(parts[0] + (parts[1].ljust(decimals, "0") \
                           if len(parts) >= 2 \
                           else "0" * decimals))

def output(index, addresses, amounts):
    print("_" * 64)
    print("{}...{}".format(index + 1, index + len(addresses)))
    print()
    print(",".join(addresses))
    print()
    print(",".join(str(amount) for amount in amounts))
    print()


index = 0
addresses, amounts = [], []
with open(FILENAME) as file:
    reader = csv.DictReader(file)
    for row in reader:
        addresses.append(row["Public Ethereum Address"])
        amounts.append(quanta(row["Tokens Bought"]) \
                     + quanta(row["Bonus Tokens Issued"]))
        if len(addresses) == CHUNKSIZE:
            output(index, addresses, amounts)
            index += CHUNKSIZE
            addresses, amounts = [], []
if addresses:
    output(index, addresses, amounts)
