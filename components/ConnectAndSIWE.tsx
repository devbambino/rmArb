import { useCallback, useEffect, useState } from "react";
import type { Hex } from "viem";
import { useAccount, useConnect, usePublicClient, useSignMessage, useDisconnect } from "wagmi";
import { SiweMessage } from "siwe";
import { cbWalletConnector } from "@/wagmi";

export function ConnectAndSIWE() {
  const { disconnect } = useDisconnect();
  const { connect } = useConnect({
    mutation: {
      onSuccess: (data) => {
        const address = data.accounts[0];
        const chainId = data.chainId;
        /*const m = new SiweMessage({
          domain: document.location.host,
          address,
          chainId,
          uri: document.location.origin,
          version: "1",
          statement: "Msj SIWE",
        });
        setMessage(m);
        signMessage({ message: m.prepareMessage() });*/
      },
    },
  });
  const account = useAccount();
  const client = usePublicClient();
  const [signature, setSignature] = useState<Hex | undefined>(undefined);
  const { signMessage } = useSignMessage({
    mutation: { onSuccess: (sig) => setSignature(sig) },
  });
  const [message, setMessage] = useState<SiweMessage | undefined>(undefined);

  const [valid, setValid] = useState<boolean | undefined>(undefined);

  const checkValid = useCallback(async () => {
    if (!signature || !account.address || !client || !message) return;

    client
      .verifyMessage({
        address: account.address,
        message: message.prepareMessage(),
        signature,
      })
      .then((v) => setValid(v));
  }, [signature, account]);

  useEffect(() => {
    //checkValid();
  }, [account]);

  useEffect(() => { });

  return (
    <div>
      {account.status === "connected" ? (
        <button type="button" onClick={() => disconnect()}>
          Disconnect
        </button>
      ) : (
        <button onClick={() => connect({ connector: cbWalletConnector })}>
          Connect
        </button>
      )}

      <p>{ }</p>
      {account && <p>{account.status}:{account.address} </p>}
    </div>
  );
}