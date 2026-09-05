import type { StudioAssets, StudioChartRecord } from "../lib/types";

function coverSource(record: StudioChartRecord, assets: StudioAssets) {
  if (!record.imageName) return undefined;
  return assets.covers[record.imageName]
    ?? `/api/asset?url=${encodeURIComponent(`https://shama.dxrating.net/images/cover/v2/${record.imageName}.jpg`)}`;
}

export default function SongCover({ record, assets }: { record: StudioChartRecord; assets: StudioAssets }) {
  const source = coverSource(record, assets);
  return (
    <div className="upgrade-cover" aria-hidden="true">
      <span>♪</span>
      {source ? <img src={source} alt="" loading="lazy" onError={(event) => { event.currentTarget.hidden = true; }} /> : null}
    </div>
  );
}
