import { NavLink } from "react-router-dom";

import { moduleCatalog } from "@modules/catalog";
import { preloadModule } from "@modules/registry";

export function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar__brand">
        <div className="sidebar__mark">PN</div>
        <div>
          <strong>页巢</strong>
          <p>把散落的页面功能收回一个书房里。</p>
        </div>
      </div>

      <nav className="sidebar__nav">
        <NavLink
          className={({ isActive }) =>
            isActive ? "sidebar__link sidebar__link--active" : "sidebar__link"
          }
          end
          to="/"
        >
          首页
        </NavLink>

        {moduleCatalog.map((moduleItem) => (
          <NavLink
            key={moduleItem.slug}
            className={({ isActive }) =>
              isActive ? "sidebar__link sidebar__link--active" : "sidebar__link"
            }
            onMouseEnter={() => {
              preloadModule(moduleItem.slug);
            }}
            onFocus={() => {
              preloadModule(moduleItem.slug);
            }}
            to={`/m/${moduleItem.slug}`}
          >
            <span>{moduleItem.icon}</span>
            <span>{moduleItem.title}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar__footer">
        <p>Modules are lazy-loaded.</p>
        <p>D1 stores state, R2 stores files.</p>
      </div>
    </aside>
  );
}

