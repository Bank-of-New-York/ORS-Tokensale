#!/usr/bin/env python3

from collections import OrderedDict
import csv
import re

FILENAME = "20180512_FINAL_PreSale_MasterData_Lukas _v5.csv"
CHUNKSIZE = 100

USE_BRACKETS = True
USE_QUOTES = True


def uint(number):
    decimals = 18
    parts = number.split(",")
    return int(parts[0] + (parts[1].ljust(decimals, "0") \
                           if len(parts) >= 2 \
                           else "0" * decimals))


data = OrderedDict()
with open(FILENAME) as file:
    reader = csv.DictReader(file)
    index = 0
    for row in reader:
        index += 1
        address = row["Public Ethereum Address"].lower()
        if not re.match("0x[0-9a-f]{40}$", address):
            continue
        amount = uint(row["Tokens Bought"]) + uint(row["Bonus Tokens Issued"])
        if address in data:
            print("WARNING: duplicate address", address, "in row", index)
            data[address] += amount
        else:
            data[address] = amount

total = sum(data.values())
index = 0
data = list(data.items())
while index < len(data):
    addresses, amounts = zip(*data[index : index + CHUNKSIZE])
    list_fmt = "[{}]" if USE_BRACKETS else "{}"
    item_fmt = "'{}'" if USE_QUOTES else "{}"
    print("_" * 64)
    print("{}...{}".format(index + 1, index + len(addresses)))
    print()
    print(list_fmt.format(",".join(item_fmt.format(address)
                                   for address in addresses)))
    print()
    print(list_fmt.format(",".join(item_fmt.format(amount)
                                   for amount in amounts)))
    print()
    index += CHUNKSIZE

print("_" * 64)
print("Number of distinct addresses:", len(data))
print()

cap = uint("222247844")
print("    Cap   {:>28}".format(cap))
print("  - Total {:>28}".format(total))
print("  " + "-" * 36)
print("  = Rem.  {:>28}".format(cap - total))
