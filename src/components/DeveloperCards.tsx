import { DEVELOPERS } from "@/data/developers";

export function DeveloperCards() {
  return (
    <div className="ares-title-team">
      <div className="ares-title-team-heading">
        <span>DEVELOPMENT TEAM</span><span>03 MEMBERS</span>
      </div>
      <ul className="ares-developer-grid" aria-label="Development team">
        {DEVELOPERS.map((developer, index) => (
          <li key={developer.id}>
            <article className="ares-developer-card">
              <div className="ares-developer-card-top">
                <span className="ares-developer-index" aria-hidden="true">0{index + 1}</span>
                {developer.avatar && <div className="ares-developer-avatar">
                    <img src={developer.avatar} alt="" width={30} height={30} />
                </div>}
              </div>
              <h3>{developer.nickname}</h3>
              <p>{developer.role}</p>
            </article>
          </li>
        ))}
      </ul>
    </div>
  );
}
