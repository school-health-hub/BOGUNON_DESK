import image0 from "./assets/students/01-winter-gut.png?inline";
import image1 from "./assets/students/02-cold-commute.png?inline";
import image2 from "./assets/students/03-antibiotics.png?inline";
import image3 from "./assets/students/04-caffeine.png?inline";
import image4 from "./assets/students/05-tobacco-refusal.png?inline";
import image5 from "./assets/students/06-hotpack.png?inline";
import image6 from "./assets/students/cover-students-composition-candidate.png?inline";
import image7 from "./assets/students/handwash-composition-candidate.png?inline";
import image8 from "./assets/students/restore-cover-hero.png?inline";
import image9 from "./assets/students/restore-gut-handwash.png?inline";
import image10 from "./assets/students/ns3e-b-candidate-cover-students.png?inline";
import image11 from "./assets/students/ns3e-b-candidate-inner-handwash.png?inline";
import image12 from "./assets/students/ns3e-b-framed-cover-students.png?inline";
import image13 from "./assets/students/ns3e-b-framed-inner-handwash.png?inline";
import image14 from "./assets/students/ns3e-b-candidate-inner-cooking.png?inline";
import image15 from "./assets/students/ns3e-b-candidate-inner-boiling.png?inline";
import image16 from "./assets/students/ns3e-b-candidate-inner-reporting.png?inline";
import image17 from "./assets/students/ns3e-b-framed-inner-cooking.png?inline";
import image18 from "./assets/students/ns3e-b-framed-inner-boiling.png?inline";
import image19 from "./assets/students/ns3e-b-framed-inner-reporting.png?inline";
const sources: Readonly<Record<string, string>> = { "7f2fe2b3f1494409d5c50205c8b7e39f2ff21c235a22949d8a074350058426b8": image0, "48d290e964340c06f46705461beb8ddcc523166890f6ea3c3e21beb3f5a3f476": image1, "bd51ac4fd84f6ac0f44d1a5b0b6b528a946b4024ebbff245e9f7f0a9ee80f202": image2, "830c80fd045cbd95ed053e7be0e48156ec2213dbb8df07e6643bcc32c80f151c": image3, "a26409eeca4696582f735969f0e856bc2f4a3fdc0579c336710c6a4b4be151e8": image4, "4fe5cf9adbfd6ad2a77ba94984ca91d595967e395dff785e4c8189fa6c33e823": image5, "6d6cbf9d42b8205525598772684a689e043fa6dec77a773e3ae38486a0023a71": image6, "79778701e41c14a559c3926e6d5f2ef95a2ffcc1a24921eb90db8f69575eacce": image7, "6ed886bfb2ccc5894d6c757acbca77fd3caa2dfb22b81125741e2f2e45b628af": image8, "fb1b4a6b1d3afae7afbe341e44d435ffe4cc5e260c0d7405400928a7e97e4bb5": image9, "3bcd44ce906241fb5fdbfaa58f6dca4ff561cf077769b9227400f2be685a2279": image10, "6318470453ef15bf60e0b1a8fc500b1d60ef34166144e439bdd597c780af26db": image11, "49f950389a5ec325e3ced7bc829c6da3d922db7408868c7155cb2c5466f51936": image12, "ae4fe6645cf4ab8417ab73b3e0d76025487b370330d7db181f01b2cd68f18537": image13, "dfb500637b750e0614cae68d21fdaf5162cf413a5daaea9a6e5d1cd6d15115f1": image14, "a762cfedbb871a17e72fb4dff81e920fc2abb2500ec201b8f98dde535108e4d8": image15, "123aaaaaaa6a68f16c0526c6ea73970f28bd02628d4bd7aab8c85f16141d2c16": image16, "69caf7781dcd6280d5ca2d2158e674d475b4f25160e4f1b9e08c01c47e48e500": image17, "f485d34dd7207d0419d3a65e64bf6f9ec967b4d78dc0b3e52020b3cc06e875e9": image18, "94697a665a324a87f66af9cd1fb8981d870eb04b865a3f504d5a85d62c5c1330": image19 };
export function studentArtSource(hash: string): string | undefined { return sources[hash]; }
export function studentArtBytes(hash: string): Uint8Array | undefined { const s = sources[hash]; if (s === undefined)
    return undefined; return Uint8Array.from(atob(s.slice(s.indexOf(",") + 1)), c => c.charCodeAt(0)); }
