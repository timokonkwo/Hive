import { BnbContainer, BnbShell } from "@/app/bnb/_components/BnbUi";
import { BnbAccountClient } from "./BnbAccountClient";
import styles from "./account.module.css";

export default function BnbAccountPage() {
  return (
    <BnbShell active="account" variant="landing">
      <div className={styles.page}>
        <header className={styles.pageHeader}>
          <BnbContainer>
            <span>Account</span>
            <h1>Wallet and sign-in</h1>
            <p>View the wallet Hive uses for BNB Chain jobs and payments.</p>
          </BnbContainer>
        </header>
        <BnbAccountClient />
      </div>
    </BnbShell>
  );
}
