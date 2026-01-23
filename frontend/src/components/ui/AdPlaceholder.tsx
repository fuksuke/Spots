import { ComponentPropsWithoutRef } from "react";
import styled from "styled-components";

const AdContainer = styled.div`
  width: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  /* margin: 1rem 0; Removed default margin to avoid double spacing in grids */
  pointer-events: none; /* Prevent clicks on placeholder from doing anything weird */
`;

const AdContent = styled.div<{ $isThin?: boolean }>`
  width: 100%;
  /* Standard mobile banner size or flexible */
  height: ${props => props.$isThin ? "50px" : "250px"};
  background-color: #f1f5f9;
  border: 1px dashed #cbd5e1;
  display: flex;
  justify-content: center;
  align-items: center;
  color: #94a3b8;
  font-size: 0.875rem;
  font-weight: 500;
  border-radius: 8px;
  position: relative;

  &::after {
    content: "広告";
    position: absolute;
    top: 0.25rem;
    right: 0.5rem;
    font-size: 0.7rem;
    color: #cbd5e1;
    border: 1px solid #cbd5e1;
    padding: 0 4px;
    border-radius: 4px;
  }
  pointer-events: auto; /* Enable clicks on the ad banner itself */
`;

type AdPlaceholderProps = ComponentPropsWithoutRef<"div"> & {
  type?: "thin" | "card";
  label?: string;
};

export const AdPlaceholder = ({ type = "card", label = "Google AdSense", ...props }: AdPlaceholderProps) => {
  return (
    <AdContainer {...props}>
      <AdContent $isThin={type === "thin"}>
        {label}
      </AdContent>
    </AdContainer>
  );
};
