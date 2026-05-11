#!/bin/bash
export PATH=$PWD/solana-release/bin:$PATH
for i in {1..5}
do
  echo "Attempt $i to airdrop SOL..."
  solana airdrop 1 --url devnet
  if [ $? -eq 0 ]; then
    echo "Airdrop successful!"
    exit 0
  fi
  echo "Attempt $i failed. Waiting 5 seconds..."
  sleep 5
done
echo "All attempts failed."
exit 1
