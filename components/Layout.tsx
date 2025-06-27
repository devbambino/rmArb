import { FC } from "react";
import Footer from "@/components/Footer";
import Header from "@/components/Header";
import BottomTabBar from "@/components/TabBar";
import Head from 'next/head';

interface Props {
    children: React.ReactNode;
}
const Layout: FC<Props> = ({ children }) => {
    return (
        <>
            <div className="overflow-hidden flex flex-col min-h-screen">
                <Head>
                    <title>RapiMoni – Empowering Purchases, Empowering You</title>
                    <meta name="description" content="QR/URL payments & one-loan-at-once BNPL in MXNe/BRZ, backed by USDC." />
                </Head>
                <Header />
                {children}
                <Footer />
                {/* Mobile Bottom Tab Bar */}
                <BottomTabBar />
            </div>
        </>
    );
};

export default Layout;
